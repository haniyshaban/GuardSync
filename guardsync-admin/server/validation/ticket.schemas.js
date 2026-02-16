import { z } from 'zod';
import { commonSchemas } from './index.js';

// Create support ticket schema
export const createTicketSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  email: commonSchemas.email,
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject must be at most 200 characters'),
  message: z.string().min(1, 'Message is required').max(2000, 'Message must be at most 2000 characters'),
});

// Resolve ticket schema
export const resolveTicketSchema = z.object({
  resolvedBy: z.string().optional(),
  response: z.string().max(2000).optional(),
});

// Ticket query schema
export const ticketQuerySchema = z.object({
  status: z.enum(['open', 'resolved', 'closed']).optional(),
});
