import net from 'net';
import tls from 'tls';
import { config } from '../config';
import { logger } from '../utils/logger';
import { captureException } from '../utils/sentry';

export interface OutboundMessage {
  to: string;
  subject: string;
  /** Plain-text body. */
  text: string;
}

export interface DeliveryResult {
  delivered: number;
  failed: number;
  /** Transport that handled the batch. 'log' means nothing left the process. */
  channel: 'resend' | 'smtp' | 'log';
  errors: string[];
}

/**
 * Minimal SMTP client.
 *
 * Implemented over the standard library rather than adding nodemailer, because the only
 * requirement is "send a plain-text message to an SMTP relay". Supports implicit TLS
 * (port 465) and STARTTLS, with AUTH LOGIN.
 *
 * Not a general-purpose mailer: no attachments, no HTML multipart, no connection pooling.
 * For high volume, swap this adapter for a provider SDK — the interface stays the same.
 */
class SmtpTransport {
  private socket: net.Socket | tls.TLSSocket | null = null;
  private buffer = '';

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly secure: boolean,
    private readonly user: string,
    private readonly password: string
  ) {}

  private read(expect: number, timeoutMs = 15_000): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = this.socket!;
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`SMTP timeout waiting for ${expect}`));
      }, timeoutMs);

      const onData = (chunk: Buffer) => {
        this.buffer += chunk.toString('utf8');
        // A complete reply ends with "<code><SP>...<CRLF>"; continuation uses "<code>-".
        const lines = this.buffer.split(/\r?\n/).filter(Boolean);
        const last = lines[lines.length - 1];
        if (!last || !/^\d{3}[ ]/.test(last)) return;

        const payload = this.buffer;
        this.buffer = '';
        cleanup();

        const code = Number(last.slice(0, 3));
        if (code !== expect) return reject(new Error(`SMTP expected ${expect}, got ${code}: ${last.trim()}`));
        resolve(payload);
      };

      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };

      function cleanup() {
        clearTimeout(timer);
        socket.off('data', onData);
        socket.off('error', onError);
      }

      socket.on('data', onData);
      socket.on('error', onError);
    });
  }

  private write(line: string) {
    this.socket!.write(line + '\r\n');
  }

  private async command(line: string, expect: number) {
    this.write(line);
    return this.read(expect);
  }

  async connect() {
    this.socket = this.secure
      ? tls.connect({ host: this.host, port: this.port, servername: this.host })
      : net.connect({ host: this.host, port: this.port });

    await new Promise<void>((resolve, reject) => {
      const s = this.socket!;
      const onReady = () => {
        s.off('error', onErr);
        resolve();
      };
      const onErr = (e: Error) => {
        s.off('secureConnect', onReady);
        s.off('connect', onReady);
        reject(e);
      };
      s.once(this.secure ? 'secureConnect' : 'connect', onReady);
      s.once('error', onErr);
    });

    await this.read(220);
    await this.command(`EHLO ${this.host}`, 250);

    if (!this.secure) {
      // Opportunistic STARTTLS: never send credentials over a plaintext socket.
      try {
        await this.command('STARTTLS', 220);
        const plain = this.socket as net.Socket;
        this.socket = tls.connect({ socket: plain, servername: this.host });
        await new Promise<void>((resolve, reject) => {
          this.socket!.once('secureConnect', () => resolve());
          this.socket!.once('error', reject);
        });
        await this.command(`EHLO ${this.host}`, 250);
      } catch (err: any) {
        if (this.user)
          throw new Error(`STARTTLS unavailable, refusing to send credentials in plaintext: ${err.message}`);
        logger.warn('SMTP server does not support STARTTLS; continuing unauthenticated', { host: this.host });
      }
    }

    if (this.user) {
      await this.command('AUTH LOGIN', 334);
      await this.command(Buffer.from(this.user).toString('base64'), 334);
      await this.command(Buffer.from(this.password).toString('base64'), 235);
    }
  }

  async send(from: string, message: OutboundMessage) {
    const fromAddress = from.match(/<([^>]+)>/)?.[1] || from;

    await this.command(`MAIL FROM:<${fromAddress}>`, 250);
    await this.command(`RCPT TO:<${message.to}>`, 250);
    await this.command('DATA', 354);

    const headers = [
      `From: ${from}`,
      `To: ${message.to}`,
      `Subject: ${message.subject.replace(/[\r\n]/g, ' ')}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      `Date: ${new Date().toUTCString()}`,
    ].join('\r\n');

    // Dot-stuffing: a lone "." would otherwise terminate the message body early.
    const body = message.text.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');

    this.write(`${headers}\r\n\r\n${body}\r\n.`);
    await this.read(250);
  }

  async quit() {
    try {
      if (this.socket && !this.socket.destroyed) {
        this.write('QUIT');
        this.socket.end();
      }
    } catch {
      // Closing is best-effort.
    }
  }
}

/**
 * Delivers notification messages.
 *
 * Transport order: Resend (when RESEND_API_KEY and RESEND_FROM_EMAIL are set), then SMTP,
 * then log-only. Resend is imported lazily to avoid a circular import — emailService
 * imports this module for its own SMTP fallback.
 *
 * Without any transport this logs each message and reports channel 'log'. That keeps the
 * dispatch pipeline honest — the workflow reports what it actually did rather than
 * implying delivery that never happened.
 */
export async function deliverMessages(messages: OutboundMessage[]): Promise<DeliveryResult> {
  if (messages.length === 0) {
    return { delivered: 0, failed: 0, channel: isDeliveryConfigured() ? 'resend' : 'log', errors: [] };
  }

  // Prefer Resend when configured.
  if (config.resend.apiKey && config.resend.fromEmail) {
    const errors: string[] = [];
    let delivered = 0;
    let failed = 0;

    try {
      const { Resend } = await import('resend');
      const client = new Resend(config.resend.apiKey);
      const from = `${config.resend.fromName} <${config.resend.fromEmail}>`;

      for (const message of messages) {
        try {
          const { data, error } = await client.emails.send({
            from,
            to: message.to,
            subject: message.subject,
            text: message.text,
            ...(config.resend.replyTo ? { replyTo: config.resend.replyTo } : {}),
          });
          if (error) throw new Error(error.message || 'Resend rejected the message.');
          delivered++;
          logger.debug('Notification delivered via Resend', { to: message.to, id: data?.id });
        } catch (err: any) {
          failed++;
          errors.push(`${message.to}: ${err.message}`);
          logger.warn('Resend notification delivery failed', { to: message.to, message: err.message });
        }
      }

      // Total failure falls through to SMTP if one is configured.
      if (delivered === 0 && config.smtp.host) {
        logger.warn('Resend delivered nothing — retrying via SMTP', { count: messages.length });
      } else {
        return { delivered, failed, channel: 'resend', errors: errors.slice(0, 10) };
      }
    } catch (err: any) {
      logger.error('Resend transport unavailable', { message: err?.message });
      captureException(err, {
        area: 'email',
        level: 'error',
        extra: { transport: 'resend', stage: 'transport-init', batchSize: messages.length },
      });
      if (!config.smtp.host) {
        return {
          delivered: 0,
          failed: messages.length,
          channel: 'resend',
          errors: [`Resend transport error: ${err?.message}`],
        };
      }
    }
  }

  if (!config.smtp.host) {
    messages.forEach((m) =>
      logger.info('Notification (no transport configured — not sent)', { to: m.to, subject: m.subject })
    );
    return {
      delivered: 0,
      failed: 0,
      channel: 'log',
      errors: ['No email transport configured (RESEND_API_KEY / SMTP_HOST unset); messages were logged only.'],
    };
  }

  const transport = new SmtpTransport(
    config.smtp.host,
    config.smtp.port,
    config.smtp.secure || config.smtp.port === 465,
    config.smtp.user,
    config.smtp.password
  );

  const errors: string[] = [];
  let delivered = 0;
  let failed = 0;

  try {
    await transport.connect();

    for (const message of messages) {
      try {
        await transport.send(config.smtp.from, message);
        delivered++;
      } catch (err: any) {
        failed++;
        errors.push(`${message.to}: ${err.message}`);
        logger.warn('Notification delivery failed', { to: message.to, message: err.message });
      }
    }
  } catch (err: any) {
    // Connection-level failure: nothing was sent.
    failed = messages.length;
    errors.push(`SMTP connection failed: ${err.message}`);
    logger.error('SMTP connection failed — notifications not delivered', {
      host: config.smtp.host,
      message: err.message,
    });
    captureException(err, {
      area: 'email',
      level: 'error',
      extra: {
        transport: 'smtp',
        stage: 'connect',
        host: config.smtp.host,
        port: config.smtp.port,
        batchSize: messages.length,
      },
    });
  } finally {
    await transport.quit();
  }

  return { delivered, failed, channel: 'smtp', errors: errors.slice(0, 10) };
}

export function isDeliveryConfigured(): boolean {
  return Boolean((config.resend.apiKey && config.resend.fromEmail) || config.smtp.host);
}
