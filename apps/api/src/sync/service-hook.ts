import { z } from 'zod';

/**
 * The only parts of an Azure DevOps service hook payload we read. The payload is used purely
 * as a "something changed in project X" signal; the actual data is re-fetched from ADO.
 */
export const serviceHookPayload = z.object({
  eventType: z.string().max(100),
  resourceContainers: z.object({ project: z.object({ id: z.guid() }).optional() }).optional(),
});

/** Returns the project id for work item events, or null for anything else. */
export function projectIdFromServiceHook(body: unknown): string | null {
  const parsed = serviceHookPayload.safeParse(body);
  if (!parsed.success || !parsed.data.eventType.startsWith('workitem.')) return null;
  return parsed.data.resourceContainers?.project?.id ?? null;
}
