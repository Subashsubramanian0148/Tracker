import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { WorkItemAiSummary, WorkItemDetail } from '@ado-metrics/shared';
import { z } from 'zod';
import { AdoClient } from '../ado/ado.client';
import { htmlToPlain } from '../ado/fields';
import { APP_CONFIG, AppConfig } from '../config/config';
import type { SessionUser } from '../common/session.types';
import { PrismaService } from '../prisma/prisma.service';
import { WorkItemsService } from './work-items.service';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_COMMENTS = 40;
const MAX_TEXT = 1500;

const groqResponse = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});
const summaryShape = z.object({
  status: z.string().catch(''),
  timeline: z.array(z.object({ date: z.string(), event: z.string() })).catch([]),
  waitingOn: z
    .object({ party: z.string(), since: z.string().nullable().catch(null), reason: z.string() })
    .nullable()
    .catch(null),
  delayOwner: z.enum(['UX team', 'Others', 'None', 'Unclear']).catch('Unclear'),
  split: z
    .object({ ux: z.number().min(0), others: z.number().min(0) })
    .nullable()
    .catch(null),
  nextStep: z.string().catch(''),
});

const SYSTEM = `You write the story of an Azure DevOps work item for a UX team lead.
Use only the facts given; never guess. Write plain, short sentences with people's names and dates.
Each activity line is tagged [UX] (a UX team member) or [OTHER] (BA, product, dev or anyone else).
Reply with JSON only:
{"status": string,
 "timeline": [{"date": "YYYY-MM-DD", "event": string}],
 "waitingOn": {"party": string, "since": "YYYY-MM-DD" | null, "reason": string} | null,
 "delayOwner": "UX team" | "Others" | "None" | "Unclear",
 "split": {"ux": number, "others": number},
 "nextStep": string}
- timeline events are short plain phrases (under 9 words), e.g. "Subash S shared the Figma".
  Never copy raw field changes like "changed State: X → Y"; skip routine state moves except
  when work started and when it was marked Done. No duplicates.
- timeline: 3-8 key moments, oldest first, e.g. "Story created", "Assigned to Subash S",
  "Subash S started work", "Subash S shared the Figma and asked the BA to review",
  "No reply since". Use the comment text to say what was actually done or asked.
- waitingOn: who must act next if the work is stuck on someone (e.g. "BA / Product" when UX
  asked for review or approval and nobody replied). null if it is moving or done.
- delayOwner: "Others" when the last UX action was handing off or asking for input and there is
  no reply after it; "UX team" when UX has not acted for a long time and nothing is pending
  on others; "None" when done on time or not late; "Unclear" otherwise.
- Read the PARENT comments as carefully as the story's: hand-offs (Figma links, "please
  review", "waiting for approval") are often posted there.
- If UX shared the design or asked for review, got no reply or changes from others for a long
  time, and then moved the story to Done / handed over, say exactly that in the timeline
  (e.g. "No changes from BA for 9 days, so UX handed it over") and set delayOwner "Others".
  When a QUIET BEFORE HAND-OVER line is given and that last comment left the next move with
  others (UX shared the design or asked for review, or others said they were still checking),
  add a timeline event just before Done like "No changes from BA / Product for 7 days, so UX
  handed it over", say so in status, and set delayOwner "Others".
- split: whole days from when work started (or the story was created) until Done or TODAY,
  divided by who held the next move: ux = UX working on it, others = waiting on BA / product /
  anyone outside UX (e.g. after UX shared the design). The two should add up to that span.
- status, waitingOn.reason and nextStep: write dates like "3 Nov", never YYYY-MM-DD.
- status: 1-2 sentences saying where it stands and, if waiting, for how many days.
- nextStep: the single next action and who should take it.`;

function clip(text: string | null | undefined, max = MAX_TEXT): string {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * Summarises a story, its tasks and its parent with Groq. Runs only when someone asks, and
 * the result is kept until the story or its comments change, so repeat views cost nothing.
 */
@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);
  private readonly cache = new Map<number, { key: string; summary: WorkItemAiSummary }>();

  constructor(
    private readonly items: WorkItemsService,
    private readonly ado: AdoClient,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  get enabled(): boolean {
    return !!this.config.GROQ_API_KEY;
  }

  async summarise(projectId: string, id: number, user: SessionUser): Promise<WorkItemAiSummary> {
    if (!this.config.GROQ_API_KEY)
      throw new ServiceUnavailableException('AI summaries are not set up (no GROQ_API_KEY).');
    const item = await this.items.detail(projectId, id, user);
    if (!item) throw new NotFoundException('Work item not found');

    const key = `${item.changedDate}|${item.comments.length}|${item.children.length}|${new Date().toISOString().slice(0, 10)}`;
    const cached = this.cache.get(id);
    if (cached?.key === key) return cached.summary;

    const prompt = await this.buildPrompt(projectId, item);
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.GROQ_MODEL,
        temperature: 0.2,
        // Room for the model's reasoning plus the JSON; too little cuts the JSON off (Groq 400).
        max_tokens: 4000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      this.logger.warn({ status: res.status, id, detail }, 'Groq summary failed');
      throw new ServiceUnavailableException(
        res.status === 401
          ? 'The Groq API key was refused. Check GROQ_API_KEY.'
          : 'The AI summary service did not respond. Try again shortly.',
      );
    }
    const content = groqResponse.parse(await res.json()).choices[0]!.message.content;
    let parsed: z.infer<typeof summaryShape>;
    try {
      parsed = summaryShape.parse(JSON.parse(content));
    } catch {
      throw new ServiceUnavailableException('The AI summary came back in an unexpected form.');
    }
    const summary: WorkItemAiSummary = {
      ...parsed,
      timeline: parsed.timeline.slice(0, 10),
      model: this.config.GROQ_MODEL,
      generatedAt: new Date().toISOString(),
    };
    this.cache.set(id, { key, summary });
    return summary;
  }

  /** Lower-cased names of the project's team members (the UX team). */
  private async uxNames(projectId: string): Promise<Set<string>> {
    const members = await this.prisma.teamMember.findMany({
      where: { team: { projectId } },
      select: { person: { select: { displayName: true } } },
    });
    return new Set(members.map((m) => m.person.displayName.toLowerCase()));
  }

  /** Plain-text facts about the story, its tasks and its parent. Only this text leaves the app. */
  private async buildPrompt(projectId: string, item: WorkItemDetail): Promise<string> {
    const lines: string[] = [];
    lines.push(`STORY ${item.id}: ${item.title}`);
    lines.push(`Type: ${item.type}. State: ${item.state}.`);
    lines.push(`Assigned to: ${item.assignedTo?.displayName ?? 'no one'}.`);
    lines.push(`Created: ${item.createdDate.slice(0, 10)}.`);
    if (item.activatedDate) lines.push(`Started: ${item.activatedDate.slice(0, 10)}.`);
    if (item.completedDate) lines.push(`Finished: ${item.completedDate.slice(0, 10)}.`);
    lines.push(
      item.iterationPath?.includes('\\')
        ? `Sprint: ${item.iterationPath.split('\\').pop()}${item.iterationFromParent ? ' (from parent)' : ''}.`
        : 'Sprint: none (internal task, no deadline).',
    );
    if (item.dueDate) lines.push(`Sprint ends: ${item.dueDate.slice(0, 10)}.`);
    if (item.effort !== null) lines.push(`Effort: ${item.effort} points (1 point = 4 hours).`);
    if (item.isDelayed) lines.push(`Flagged late: ${item.delayFlags.join(', ')}.`);
    if (item.description) lines.push(`Description: ${clip(item.description)}`);
    if (item.acceptanceCriteria)
      lines.push(`Acceptance criteria: ${clip(item.acceptanceCriteria)}`);

    if (item.children.length) {
      lines.push('', 'TASKS:');
      for (const c of item.children)
        lines.push(`- ${c.title} (${c.state}, ${c.assignedTo?.displayName ?? 'unassigned'})`);
    }

    // One dated activity list across the story and its parent, tagged by team.
    const ux = await this.uxNames(projectId);
    const tag = (name: string | null | undefined) =>
      name && ux.has(name.toLowerCase()) ? '[UX]' : '[OTHER]';
    const activity: { at: string; who: string; line: string }[] = [];
    for (const c of item.comments.slice(-MAX_COMMENTS)) {
      const who = c.author?.displayName ?? 'Someone';
      activity.push({
        at: c.createdAt,
        who,
        line: `${tag(who)} ${who} commented on the story: ${clip(c.text, 600)}`,
      });
    }
    for (const c of item.changes.filter((c) => c.kind !== 'OTHER').slice(-20)) {
      const who = c.changedBy?.displayName ?? 'Someone';
      activity.push({
        at: c.changedAt,
        who,
        line: `${tag(who)} ${who} changed ${c.field}: ${c.oldValue ?? '—'} → ${c.newValue ?? '—'}`,
      });
    }

    if (item.parentId) {
      const [parent, comments] = await Promise.all([
        this.ado.getWorkItemText(projectId, item.parentId),
        this.ado.listComments(projectId, item.parentId).catch(() => []),
      ]);
      if (parent) {
        lines.push(
          '',
          `PARENT ${item.parentId}: ${parent.title ?? ''} (${parent.type ?? ''}, ${parent.state ?? ''})`,
        );
        const d = htmlToPlain(parent.description);
        if (d) lines.push(`Parent description: ${clip(d)}`);
      }
      for (const c of comments.slice(-MAX_COMMENTS)) {
        const text = htmlToPlain(c.text);
        const who = c.createdBy?.displayName ?? 'Someone';
        if (text)
          activity.push({
            at: c.createdDate,
            who,
            line: `${tag(who)} ${who} commented on the parent: ${clip(text, 600)}`,
          });
      }
    }

    activity.sort((a, b) => a.at.localeCompare(b.at));
    if (activity.length) {
      lines.push('', 'ACTIVITY (oldest first):');
      for (const a of activity) lines.push(`- ${a.at.slice(0, 10)} ${a.line}`);
    }

    // Facts worked out here, so the model doesn't have to guess who acted last.
    const today = new Date();
    lines.push('', `TODAY: ${today.toISOString().slice(0, 10)}.`);
    const last = activity.at(-1);
    if (last) {
      const quiet = Math.floor((today.getTime() - Date.parse(last.at)) / 86_400_000);
      lines.push(
        `LAST ACTIVITY: ${last.at.slice(0, 10)} by ${last.who} ${tag(last.who)}; nothing since for ${quiet} days.`,
      );
    }
    if (item.completedDate) {
      // The last conversation before Done, and how long it went quiet before UX closed it.
      const lastTalk = [...activity]
        .reverse()
        .find((a) => a.at < item.completedDate! && a.line.includes('commented'));
      if (lastTalk) {
        const gap = Math.floor(
          (Date.parse(item.completedDate) - Date.parse(lastTalk.at)) / 86_400_000,
        );
        if (gap >= 2)
          lines.push(
            `QUIET BEFORE HAND-OVER: the last comment was on ${lastTalk.at.slice(0, 10)} (${lastTalk.line}). Then ${gap} days with no comments until it was marked Done on ${item.completedDate.slice(0, 10)}.`,
          );
      }
    }
    const lastUx = [...activity].reverse().find((a) => tag(a.who) === '[UX]');
    if (lastUx) {
      const otherAfter = activity.some((a) => a.at > lastUx.at && tag(a.who) === '[OTHER]');
      lines.push(
        `LAST UX ACTION: ${lastUx.at.slice(0, 10)} by ${lastUx.who}. ${
          otherAfter ? 'Others responded after it.' : 'No one outside UX has responded since.'
        }`,
      );
    }
    return lines.join('\n');
  }
}
