import { Router } from 'express';
import { ApplicationController } from '../controllers/applicationController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import {
  applicationCreateSchema,
  applicationStatusSchema,
  applicationUpdateSchema,
  applicationIdSchema,
  checklistIdSchema,
  checklistCreateSchema,
} from '../validators/applicationValidator';

const router = Router();

router.use(authenticateToken);

router.get('/', ApplicationController.getApplications);
router.post('/', validateRequest(applicationCreateSchema), ApplicationController.create);

// Checklist routes are declared before /:id so "checklist" is never captured as an id.
router.patch('/checklist/:checklistId', validateRequest(checklistIdSchema), ApplicationController.toggleChecklist);
router.delete('/checklist/:checklistId', validateRequest(checklistIdSchema), ApplicationController.deleteChecklist);

router.patch('/:id', validateRequest(applicationUpdateSchema), ApplicationController.updateApplication);
router.delete('/:id', validateRequest(applicationIdSchema), ApplicationController.deleteApplication);
router.patch('/:id/status', validateRequest(applicationStatusSchema), ApplicationController.updateStatus);
router.post('/:id/checklist', validateRequest(checklistCreateSchema), ApplicationController.addChecklist);
router.post('/:id/populate-template', validateRequest(applicationIdSchema), ApplicationController.populateTemplate);

export default router;
