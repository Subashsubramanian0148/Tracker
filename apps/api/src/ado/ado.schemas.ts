import { z } from 'zod';

/**
 * Schemas for the subset of Azure DevOps REST responses we consume. External input is
 * validated like any other untrusted data; unknown fields are ignored.
 */
export const identityRef = z.object({
  id: z.string(),
  displayName: z.string().default(''),
  uniqueName: z.string().default(''),
});
export type IdentityRef = z.infer<typeof identityRef>;

const list = <T extends z.ZodType>(item: T) => z.object({ value: z.array(item) });

export const projectsResponse = list(
  z.object({
    id: z.guid(),
    name: z.string(),
    description: z.string().nullish(),
    state: z.string().optional(),
  }),
);

export const teamsResponse = list(z.object({ id: z.guid(), name: z.string() }));

export const teamMembersResponse = list(
  z.object({ identity: identityRef, isTeamAdmin: z.boolean().optional() }),
);

export const teamFieldValuesResponse = z.object({
  field: z.object({ referenceName: z.string() }).optional(),
  values: z.array(z.object({ value: z.string(), includeChildren: z.boolean().default(false) })),
});

export const iterationsResponse = list(
  z.object({
    id: z.guid(),
    name: z.string(),
    path: z.string(),
    attributes: z
      .object({
        startDate: z.string().nullish(),
        finishDate: z.string().nullish(),
        timeFrame: z.string().nullish(),
      })
      .optional(),
  }),
);

export const workItemTypesResponse = list(z.object({ name: z.string() }));

export const workItemTypeStatesResponse = list(
  z.object({ name: z.string(), category: z.string() }),
);

export const reportingRevisionsResponse = z.object({
  values: z.array(
    z.object({
      id: z.number().int(),
      rev: z.number().int(),
      fields: z.record(z.string(), z.unknown()),
    }),
  ),
  continuationToken: z.string().nullish(),
  isLastBatch: z.boolean().default(true),
});
export type ReportingRevision = z.infer<typeof reportingRevisionsResponse>['values'][number];

export const commentsResponse = z.object({
  comments: z.array(
    z.object({
      id: z.number().int(),
      text: z.string().nullish(),
      createdBy: identityRef.nullish(),
      createdDate: z.string(),
      modifiedDate: z.string().nullish(),
      isDeleted: z.boolean().optional(),
    }),
  ),
  continuationToken: z.string().nullish(),
});
export type AdoComment = z.infer<typeof commentsResponse>['comments'][number];

export const boardsResponse = list(z.object({ id: z.string(), name: z.string() }));

export const boardColumnsResponse = list(
  z.object({
    name: z.string(),
    columnType: z.string().optional(),
    stateMappings: z.record(z.string(), z.string()).default({}),
  }),
);
