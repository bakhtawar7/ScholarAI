import { Response, NextFunction } from 'express';
import { CVAnalysisService } from '../services/cvAnalysisService';
import { SOPAssistantService } from '../services/sopAssistantService';
import { AuthenticatedRequest } from '../middleware/auth';
import pdfParse from 'pdf-parse';
import path from 'path';

// Optional mammoth import for docx.
// require() rather than a static import so a missing or broken install degrades to the
// plain-text fallback instead of crashing the whole process at module load.
let mammoth: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mammoth = require('mammoth');
} catch (err) {
  // Mammoth not available, fallback will be used
}

export class DocumentController {
  /**
   * Analyzes an uploaded CV file or plain text CV content.
   * Performs file type, size, and sanitization validation.
   */
  static async analyzeCV(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      let text = req.body.text;

      if (req.file) {
        // Safe filename check and sanitization
        const originalName = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
        const ext = path.extname(originalName).toLowerCase();
        const allowedExtensions = ['.pdf', '.txt', '.docx', '.doc'];

        if (!allowedExtensions.includes(ext)) {
          return res.status(400).json({
            error: `Unsupported file format (${ext}). Please upload a valid PDF, DOCX, or TXT document.`,
          });
        }

        // File size limit (5MB max)
        const maxSizeBytes = 5 * 1024 * 1024;
        if (req.file.size > maxSizeBytes) {
          return res.status(400).json({
            error: 'File size exceeds the maximum allowed limit of 5MB.',
          });
        }

        // Extract Text based on format
        if (req.file.mimetype === 'application/pdf' || ext === '.pdf') {
          try {
            const parsed = await pdfParse(req.file.buffer);
            text = parsed.text;
          } catch (pdfErr: any) {
            return res.status(400).json({
              error: 'Failed to extract text from PDF. Ensure the file is not password-protected or corrupt.',
            });
          }
        } else if ((ext === '.docx' || ext === '.doc') && mammoth) {
          try {
            const result = await mammoth.extractRawText({ buffer: req.file.buffer });
            text = result.value;
          } catch (docxErr: any) {
            return res.status(400).json({
              error: 'Failed to extract text from DOCX file. Please upload as PDF or TXT.',
            });
          }
        } else {
          // Plain text / buffer string extraction
          text = req.file.buffer.toString('utf-8');
        }
      }

      if (!text || text.trim().length < 30) {
        return res.status(400).json({
          error: 'CV content is too short or empty. Please provide meaningful CV text or upload a document.',
        });
      }

      const result = await CVAnalysisService.analyzeCV(userId, text.trim());
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getLatestCV(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const result = await CVAnalysisService.getLatestAnalysis(userId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getCVHistory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const history = await CVAnalysisService.getHistory(userId);
      res.status(200).json(history);
    } catch (err) {
      next(err);
    }
  }

  static async deleteCV(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const result = await CVAnalysisService.deleteAnalysis(userId, id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async syncCVProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { skills, researchSummary } = req.body;
      if (!Array.isArray(skills)) {
        return res.status(400).json({ error: 'Skills array is required for synchronization.' });
      }
      const result = await CVAnalysisService.syncToProfile(userId, skills, researchSummary);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // --- SOP Endpoints ---

  static async analyzeSOP(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { draftText, targetScholarshipTitle } = req.body;

      if (!draftText || draftText.trim().length < 30) {
        return res.status(400).json({
          error: 'SOP draft is too short. Please provide at least 30 characters of statement content to evaluate.',
        });
      }

      const result = await SOPAssistantService.analyzeSOP(userId, draftText.trim(), targetScholarshipTitle);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getSOPQuestions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { targetScholarshipTitle, fieldOfStudy } = req.query;
      const result = await SOPAssistantService.generateGuidedQuestions(
        userId,
        targetScholarshipTitle as string | undefined,
        fieldOfStudy as string | undefined
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getSOPOutline(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { targetScholarshipTitle, userInputs } = req.body;
      const result = await SOPAssistantService.generateStructuredOutline(userId, targetScholarshipTitle, userInputs);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async refineSOPSection(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { sectionTitle, originalText, instructions } = req.body;
      const result = await SOPAssistantService.refineDraftSection(
        userId,
        sectionTitle || 'Draft Section',
        originalText,
        instructions
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async saveSOPSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { targetScholarship, draftText, sessionId } = req.body;
      if (!draftText) {
        return res.status(400).json({ error: 'Draft text is required to save session.' });
      }
      const result = await SOPAssistantService.saveDraftSession(
        userId,
        targetScholarship || 'International Scholarship',
        draftText,
        sessionId
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async getSOPSessions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const sessions = await SOPAssistantService.getUserSessions(userId);
      res.status(200).json(sessions);
    } catch (err) {
      next(err);
    }
  }

  static async getSOPSessionById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const session = await SOPAssistantService.getSessionById(userId, id);
      res.status(200).json(session);
    } catch (err) {
      next(err);
    }
  }

  static async deleteSOPSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const result = await SOPAssistantService.deleteSession(userId, id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
