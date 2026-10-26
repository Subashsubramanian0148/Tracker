import { Controller, Get, Query, Req } from '@nestjs/common';
import { auditListQuery, type AuditEntry, type AuditListQuery, type Paged } from '@ado-metrics/shared';
import type { Request } from 'express';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, Roles } from '../common/decorators';
import type { SessionUser } from '../common/session.types';
import { ZodPipe } from '../common/zod-validation.pipe';

@Controller('admin/audit-logs')
@Roles('Admin')
export class AdminAuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  async list(
    @Query(new ZodPipe(auditListQuery)) q: AuditListQuery,
    @CurrentUser() user: SessionUser,
    @Req() req: Request,
  ): Promise<Paged<AuditEntry>> {
    // Reading the audit trail is itself an auditable action.
    await this.audit.record({ action: 'audit.view', outcome: 'success', actor: user, req, details: { page: q.page } });
    return this.audit.list(q);
  }

  @Get('verify')
  async verify(@CurrentUser() user: SessionUser, @Req() req: Request): Promise<{ intact: boolean; firstBrokenId: string | null }> {
    const firstBrokenId = await this.audit.verifyChain();
    await this.audit.record({ action: 'audit.verify', outcome: 'success', actor: user, req, details: { intact: !firstBrokenId } });
    return { intact: firstBrokenId === null, firstBrokenId };
  }
}
