import { Router } from 'express';
import { ragRouter } from './rag.js';
import { plannerRouter } from './planner.js';

/**
 * Composite AI Router
 * Combines RAG Chat domain routes and Study Planner domain routes
 * into a single unified Express router under `/api/ai`.
 */
export const aiRouter = Router();

// RAG Chat & Knowledge Engine Endpoints (/api/ai/chat, /api/ai/status, /api/ai/conversations, /api/ai/suggestions)
aiRouter.use('/', ragRouter);

// Study Planner Engine Endpoints (/api/ai/generate-study-plan, /api/ai/recommend-channels, /api/ai/search-resources, /api/ai/parse-markdown)
aiRouter.use('/', plannerRouter);

export { ragRouter, plannerRouter };
