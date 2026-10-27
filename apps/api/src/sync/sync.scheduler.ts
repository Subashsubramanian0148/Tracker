import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config/config';
import { SyncService } from './sync.service';

const STARTUP_DELAY_MS = 2_000;
/** Bursts of ADO events (bulk edits) collapse into one incremental sync per project. */
const DEBOUNCE_MS = 2_000;

/** Periodic full-project sync plus debounced, event-driven incremental syncs. */
@Injectable()
export class SyncScheduler implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SyncScheduler.name);
  private readonly timers = new Set<NodeJS.Timeout>();
  private readonly pending = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly sync: SyncService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.SYNC_DISABLED) {
      this.logger.warn('Background sync disabled (SYNC_DISABLED=true)');
      return;
    }
    this.track(setTimeout(() => void this.safeRun('startup'), STARTUP_DELAY_MS));
    this.track(
      setInterval(() => void this.safeRun('schedule'), this.config.SYNC_INTERVAL_SECONDS * 1000),
    );
  }

  onApplicationShutdown(): void {
    for (const t of this.timers) clearTimeout(t);
    for (const t of this.pending.values()) clearTimeout(t);
  }

  /** Called by the webhook / change queue when a project's work items changed. */
  notifyProjectChanged(projectId: string): void {
    if (this.config.SYNC_DISABLED) return;
    const existing = this.pending.get(projectId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.pending.delete(projectId);
      void this.safeRun('webhook', projectId);
    }, DEBOUNCE_MS);
    this.pending.set(projectId, timer);
  }

  private async safeRun(trigger: 'startup' | 'schedule' | 'webhook', projectId?: string) {
    try {
      await this.sync.run(trigger, projectId ? { projectId } : {});
    } catch (err) {
      this.logger.error({ err, trigger }, 'Scheduled sync crashed');
    }
  }

  private track(t: NodeJS.Timeout) {
    t.unref();
    this.timers.add(t);
  }
}
