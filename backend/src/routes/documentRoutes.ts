import { Router } from 'express';
import { DocumentController } from '../controllers/documentController';
import { authenticateToken } from '../middleware/auth';
import { aiHeavyRateLimiter } from '../middleware/rateLimiter';
import multer from 'multer';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
    // Prevents a multipart body padded with thousands of text fields.
    fields: 10,
  },
  fileFilter: (_req, file, cb) => {
    // Reject unsupported types before the buffer is read into memory.
    const allowedMime = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/octet-stream', // some browsers send this for .docx
    ];
    if (allowedMime.includes(file.mimetype) || /\.(pdf|txt|docx|doc)$/i.test(file.originalname)) {
      return cb(null, true);
    }
    cb(new Error('Unsupported file format. Upload a PDF, DOCX or TXT document.'));
  },
});

/** Turns multer's own errors into clean 400s instead of a generic 500. */
const handleUpload = (req: any, res: any, next: any) => {
  upload.single('file')(req, res, (err: any) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File exceeds the 5MB upload limit.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: 'Upload exactly one file in the "file" field.' });
    }
    return res.status(400).json({ error: err.message || 'File upload failed.' });
  });
};

const router = Router();

router.use(authenticateToken);

// CV Routes — analysis is model-backed, so it is rate limited separately.
router.post('/cv/analyze', aiHeavyRateLimiter, handleUpload, DocumentController.analyzeCV);
router.get('/cv/latest', DocumentController.getLatestCV);
router.get('/cv/history', DocumentController.getCVHistory);
router.delete('/cv/:id', DocumentController.deleteCV);
router.post('/cv/sync-profile', DocumentController.syncCVProfile);

// SOP Routes
router.get('/sop/questions', DocumentController.getSOPQuestions);
router.post('/sop/outline', DocumentController.getSOPOutline);
router.post('/sop/analyze', aiHeavyRateLimiter, DocumentController.analyzeSOP);
router.post('/sop/refine', aiHeavyRateLimiter, DocumentController.refineSOPSection);
router.post('/sop/sessions', DocumentController.saveSOPSession);
router.get('/sop/sessions', DocumentController.getSOPSessions);
router.get('/sop/sessions/:id', DocumentController.getSOPSessionById);
router.delete('/sop/sessions/:id', DocumentController.deleteSOPSession);

export default router;
