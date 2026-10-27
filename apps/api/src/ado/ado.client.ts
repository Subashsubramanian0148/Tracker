import { setTimeout as sleep } from 'node:timers/promises';
import {
  EnvironmentCredential,
  ManagedIdentityCredential,
  type TokenCredential,
} from '@azure/identity';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { z } from 'zod';
import { APP_CONFIG, AppConfig } from '../config/config';
import {
  boardColumnsResponse,
  boardsResponse,
  commentsResponse,
  type AdoComment,
  iterationsResponse,
  projectsResponse,
  reportingRevisionsResponse,
  teamFieldValuesResponse,
  teamMembersResponse,
  teamsResponse,
  workItemTypeStatesResponse,
  workItemTypesResponse,
  workItemRelationsResponse,
} from './ado.schemas';
import { REVISION_FIELDS } from './fields';

/** Well-known Entra resource id of Azure DevOps. */
export const ADO_RESOURCE = '499b84ac-1321-427f-aa17-267ca6975798';
const API_VERSION = '7.1';
/** The work item comments API is only published as a preview version. */
const COMMENTS_API_VERSION = '7.1-preview.4';
const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 30_000;

export class AdoRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

type Auth = { kind: 'bearer'; token: string } | { kind: 'service' };

/**
 * Minimal Azure DevOps REST client.
 * - Service calls use a managed identity (prod) or service principal; PAT only outside production.
 * - Every URL is built from the configured org URL with encoded path segments (no SSRF surface).
 * - 429/5xx are retried with backoff, honouring Retry-After.
 */
@Injectable()
export class AdoClient {
  private readonly logger = new Logger(AdoClient.name);
  private readonly credential: TokenCredential | null;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.credential =
      config.ADO_AUTH === 'managed-identity'
        ? new ManagedIdentityCredential(
            config.AZURE_CLIENT_ID ? { clientId: config.AZURE_CLIENT_ID } : {},
          )
        : config.ADO_AUTH === 'client-secret'
          ? new EnvironmentCredential()
          : null;
  }

  // ---- Delegated (signed-in user) -------------------------------------------------------

  /** Projects the user can access, using their own short-lived token (never stored). */
  async listProjectsForUser(userAccessToken: string): Promise<string[]> {
    const projects = await this.listProjectsWith({ kind: 'bearer', token: userAccessToken });
    return projects.map((p) => p.id);
  }

  // ---- Service identity ----------------------------------------------------------------

  listProjects() {
    return this.listProjectsWith({ kind: 'service' });
  }

  async listTeams(projectId: string) {
    const res = await this.get(
      `_apis/projects/${seg(projectId)}/teams`,
      { $top: '1000' },
      teamsResponse,
    );
    return res.value;
  }

  async listTeamMembers(projectId: string, teamId: string) {
    const res = await this.get(
      `_apis/projects/${seg(projectId)}/teams/${seg(teamId)}/members`,
      { $top: '1000' },
      teamMembersResponse,
    );
    return res.value;
  }

  async getTeamFieldValues(projectId: string, teamId: string) {
    return this.get(
      `${seg(projectId)}/${seg(teamId)}/_apis/work/teamsettings/teamfieldvalues`,
      {},
      teamFieldValuesResponse,
    );
  }

  async listTeamIterations(projectId: string, teamId: string) {
    const res = await this.get(
      `${seg(projectId)}/${seg(teamId)}/_apis/work/teamsettings/iterations`,
      {},
      iterationsResponse,
    );
    return res.value;
  }

  async listBoards(projectId: string, teamId: string) {
    const res = await this.get(
      `${seg(projectId)}/${seg(teamId)}/_apis/work/boards`,
      {},
      boardsResponse,
    );
    return res.value;
  }

  async listBoardColumns(projectId: string, teamId: string, boardId: string) {
    const res = await this.get(
      `${seg(projectId)}/${seg(teamId)}/_apis/work/boards/${seg(boardId)}/columns`,
      {},
      boardColumnsResponse,
    );
    return res.value;
  }

  async listWorkItemTypes(projectId: string) {
    const res = await this.get(
      `${seg(projectId)}/_apis/wit/workitemtypes`,
      {},
      workItemTypesResponse,
    );
    return res.value;
  }

  async listWorkItemTypeStates(projectId: string, type: string) {
    const res = await this.get(
      `${seg(projectId)}/_apis/wit/workitemtypes/${seg(type)}/states`,
      {},
      workItemTypeStatesResponse,
    );
    return res.value;
  }

  /** One batch of the reporting revisions feed; pass the returned token to continue. */
  async reportingRevisions(
    projectId: string,
    opts: { continuationToken?: string; startDateTime?: Date },
  ) {
    const query: Record<string, string> = {};
    if (opts.continuationToken) query.continuationToken = opts.continuationToken;
    else if (opts.startDateTime) query.startDateTime = opts.startDateTime.toISOString();
    return this.request(
      'POST',
      `${seg(projectId)}/_apis/wit/reporting/workitemrevisions`,
      query,
      reportingRevisionsResponse,
      { kind: 'service' },
      {
        fields: REVISION_FIELDS,
        includeIdentityRef: true,
        includeDeleted: true,
        includeLatestOnly: false,
        includeTagRef: false,
      },
    );
  }

  /** Every comment on one work item, oldest first (deleted ones skipped). */
  async listComments(projectId: string, workItemId: number): Promise<AdoComment[]> {
    const all: AdoComment[] = [];
    let continuationToken: string | undefined;
    do {
      const query: Record<string, string> = {
        $top: '200',
        order: 'asc',
        'api-version': COMMENTS_API_VERSION,
      };
      if (continuationToken) query.continuationToken = continuationToken;
      const res = await this.get(
        `${seg(projectId)}/_apis/wit/workItems/${workItemId}/comments`,
        query,
        commentsResponse,
      );
      all.push(...res.comments.filter((c) => !c.isDeleted));
      continuationToken = res.continuationToken ?? undefined;
    } while (continuationToken);
    return all;
  }

  /** Files attached to one work item (name, link and size), from its relations. */
  async listAttachments(projectId: string, workItemId: number) {
    const res = await this.get(
      `${seg(projectId)}/_apis/wit/workitems/${workItemId}`,
      { $expand: 'relations' },
      workItemRelationsResponse,
    );
    return (res.relations ?? [])
      .filter((r) => r.rel === 'AttachedFile' && r.url.startsWith('https://'))
      .map((r) => ({
        url: r.url,
        name: r.attributes?.name ?? 'Attachment',
        sizeBytes: r.attributes?.resourceSize ?? null,
      }));
  }

  workItemUrl(projectName: string, id: number): string {
    return `${this.config.ADO_ORG_URL}/${seg(projectName)}/_workitems/edit/${id}`;
  }

  // ---- Plumbing --------------------------------------------------------------------------

  private async listProjectsWith(auth: Auth) {
    const all: z.infer<typeof projectsResponse>['value'] = [];
    let continuation: string | undefined;
    do {
      const query: Record<string, string> = { $top: '500', stateFilter: 'wellFormed' };
      if (continuation) query.continuationToken = continuation;
      const { body, headers } = await this.requestWithHeaders(
        'GET',
        '_apis/projects',
        query,
        projectsResponse,
        auth,
      );
      all.push(...body.value);
      continuation = headers.get('x-ms-continuationtoken') ?? undefined;
    } while (continuation);
    return all;
  }

  private get<T>(path: string, query: Record<string, string>, schema: z.ZodType<T>): Promise<T> {
    return this.request('GET', path, query, schema, { kind: 'service' });
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    query: Record<string, string>,
    schema: z.ZodType<T>,
    auth: Auth,
    body?: unknown,
  ): Promise<T> {
    return (await this.requestWithHeaders(method, path, query, schema, auth, body)).body;
  }

  private async requestWithHeaders<T>(
    method: 'GET' | 'POST',
    path: string,
    query: Record<string, string>,
    schema: z.ZodType<T>,
    auth: Auth,
    body?: unknown,
  ): Promise<{ body: T; headers: Headers }> {
    const url = new URL(`${this.config.ADO_ORG_URL}/${path}`);
    for (const [k, v] of Object.entries({ 'api-version': API_VERSION, ...query })) {
      url.searchParams.set(k, v);
    }

    for (let attempt = 1; ; attempt++) {
      const res = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: await this.authorization(auth),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (res.ok) {
        const parsed = schema.safeParse(await res.json());
        if (!parsed.success) {
          throw new AdoRequestError(`Unexpected response shape from ${url.pathname}`, 502);
        }
        return { body: parsed.data, headers: res.headers };
      }

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= MAX_ATTEMPTS) {
        // Body is not logged: it may echo request data. Status + path is enough to diagnose.
        throw new AdoRequestError(
          `Azure DevOps ${method} ${url.pathname} failed: ${res.status}`,
          res.status,
        );
      }
      const retryAfterSec = Number(res.headers.get('retry-after'));
      const delayMs =
        Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? Math.min(retryAfterSec * 1000, 60_000)
          : Math.min(2 ** attempt * 500, 15_000) + Math.floor(Math.random() * 250);
      this.logger.warn(
        { status: res.status, path: url.pathname, attempt, delayMs },
        'ADO request retry',
      );
      await sleep(delayMs);
    }
  }

  private async authorization(auth: Auth): Promise<string> {
    if (auth.kind === 'bearer') return `Bearer ${auth.token}`;
    if (this.config.ADO_AUTH === 'pat') {
      return `Basic ${Buffer.from(`:${this.config.ADO_PAT}`).toString('base64')}`;
    }
    const token = await this.credential!.getToken(`${ADO_RESOURCE}/.default`);
    if (!token) throw new AdoRequestError('Could not acquire Azure DevOps token', 401);
    return `Bearer ${token.token}`;
  }
}

/** Encodes one URL path segment (project/team names may contain spaces and unicode). */
function seg(value: string): string {
  return encodeURIComponent(value);
}
