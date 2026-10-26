import { setTimeout as sleep } from 'node:timers/promises';
import { ManagedIdentityCredential, type TokenCredential } from '@azure/identity';
import { ServiceBusClient, type ServiceBusReceiver } from '@azure/service-bus';
import { QueueClient } from '@azure/storage-queue';
import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../config/config';
import { projectIdFromServiceHook } from './service-hook';
import { SyncScheduler } from './sync.scheduler';

const IDLE_POLL_MS = 10_000;
const MAX_MESSAGE_BYTES = 64 * 1024;
const BATCH_SIZE = 32;

/**
 * Consumes Azure DevOps service hook events from Azure Service Bus (default) or an Azure
 * Storage Queue, using the app's managed identity. This keeps the app fully private: ADO pushes
 * to the queue with a send-only credential, the app pulls.
 *
 * Messages may be duplicated, reordered or minimal, so they never carry data into the app: a
 * message only names a project, which triggers an incremental re-fetch from Azure DevOps.
 */
@Injectable()
export class ChangeQueueConsumer implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ChangeQueueConsumer.name);
  private readonly abort = new AbortController();
  private serviceBus: ServiceBusClient | null = null;

  constructor(
    private readonly scheduler: SyncScheduler,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    const { CHANGE_QUEUE_KIND: kind, CHANGE_QUEUE_URL: url } = this.config;
    if (this.config.SYNC_DISABLED || kind === 'none' || !url) return;
    const credential: TokenCredential = new ManagedIdentityCredential(
      this.config.AZURE_CLIENT_ID ? { clientId: this.config.AZURE_CLIENT_ID } : {},
    );

    if (kind === 'servicebus') {
      const { host, queue } = parseServiceBusUrl(url);
      this.serviceBus = new ServiceBusClient(host, credential);
      void this.serviceBusLoop(this.serviceBus.createReceiver(queue, { receiveMode: 'peekLock' }));
    } else {
      void this.storageLoop(new QueueClient(url, credential));
    }
    this.logger.log(`Change queue consumer started (${kind})`);
  }

  async onApplicationShutdown(): Promise<void> {
    this.abort.abort();
    await this.serviceBus?.close().catch(() => undefined);
  }

  private async serviceBusLoop(receiver: ServiceBusReceiver) {
    while (!this.abort.signal.aborted) {
      try {
        const messages = await receiver.receiveMessages(BATCH_SIZE, {
          maxWaitTimeInMs: IDLE_POLL_MS,
          abortSignal: this.abort.signal,
        });
        for (const msg of messages) {
          this.handle(bodyText(msg.body));
          // Peek-lock: settle only after the message was handled. A crash before this point
          // lets the lock expire and the message is redelivered (dead-lettered after 10 tries).
          await receiver.completeMessage(msg);
        }
      } catch (err) {
        if (this.abort.signal.aborted) return;
        await this.backOff(err);
      }
    }
  }

  private async storageLoop(queue: QueueClient) {
    while (!this.abort.signal.aborted) {
      try {
        const { receivedMessageItems } = await queue.receiveMessages({
          numberOfMessages: BATCH_SIZE,
          visibilityTimeout: 60,
          abortSignal: this.abort.signal,
        });
        for (const msg of receivedMessageItems) {
          this.handle(msg.messageText);
          await queue.deleteMessage(msg.messageId, msg.popReceipt);
        }
        if (receivedMessageItems.length === 0) await sleep(IDLE_POLL_MS, undefined, { signal: this.abort.signal });
      } catch (err) {
        if (this.abort.signal.aborted) return;
        await this.backOff(err);
      }
    }
  }

  private async backOff(err: unknown) {
    this.logger.error({ err }, 'Change queue receive failed; backing off');
    await sleep(IDLE_POLL_MS * 3, undefined, { signal: this.abort.signal }).catch(() => undefined);
  }

  private handle(text: string | null) {
    if (text === null || Buffer.byteLength(text) > MAX_MESSAGE_BYTES) {
      this.logger.warn('Dropped unreadable or oversized change message');
      return;
    }
    const projectId = projectIdFromServiceHook(safeJson(text));
    if (projectId) this.scheduler.notifyProjectChanged(projectId);
  }
}

/** `https://<namespace>.servicebus.windows.net/<queue>` → namespace host and queue name. */
export function parseServiceBusUrl(url: string): { host: string; queue: string } {
  const u = new URL(url);
  const queue = decodeURIComponent(u.pathname.replace(/^\/+|\/+$/g, ''));
  if (u.protocol !== 'https:' || !u.hostname.endsWith('.servicebus.windows.net') || !queue || queue.includes('/')) {
    throw new Error('CHANGE_QUEUE_URL must be https://<namespace>.servicebus.windows.net/<queue>');
  }
  return { host: u.hostname, queue };
}

/** Service Bus bodies arrive decoded as an object, a string or raw bytes depending on the sender. */
export function bodyText(body: unknown): string | null {
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) return Buffer.from(body).toString('utf8');
  if (body !== null && typeof body === 'object') {
    try {
      return JSON.stringify(body);
    } catch {
      return null;
    }
  }
  return null;
}

/** ADO may base64-encode queue messages depending on the consumer settings; accept both. */
function safeJson(text: string): unknown {
  for (const candidate of [text, Buffer.from(text, 'base64').toString('utf8')]) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next encoding
    }
  }
  return null;
}
