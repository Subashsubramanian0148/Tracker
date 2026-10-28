import { Injectable, NotFoundException } from '@nestjs/common';
import type { PersonRef } from '@ado-metrics/shared';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { hasRole } from './guards';
import type { SprintWindow } from '../metrics/engine/delays';
import type { SessionUser } from './session.types';

export interface PersonVisibility {
  /** True when the viewer may see individual-level data for every person. */
  all: boolean;
  /** Person ids whose individual data the viewer may see (self + led teams). */
  ids: ReadonlySet<string>;
}

/** Team scoping and per-person privacy rules shared by all read endpoints. */
@Injectable()
export class ScopeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Work item filter for a team's area paths. Throws 404 if the team isn't in the project. */
  async teamWhere(projectId: string, teamId?: string): Promise<Prisma.WorkItemWhereInput> {
    if (!teamId) return {};
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, projectId },
      include: { areas: true },
    });
    if (!team) throw new NotFoundException('Team not found');
    if (team.areas.length === 0) return { id: -1 };
    return {
      OR: team.areas.flatMap((a) => [
        { areaPath: a.areaPath },
        ...(a.includeChildren ? [{ areaPath: { startsWith: `${a.areaPath}\\` } }] : []),
      ]),
    };
  }

  /**
   * Who the viewer may see individually: Managers/Admins see everyone, Team Leads see members of
   * teams they belong to, everyone sees themselves.
   */
  async personVisibility(user: SessionUser, projectId: string): Promise<PersonVisibility> {
    if (hasRole(user.roles, 'Manager')) return { all: true, ids: new Set() };
    const me = await this.prisma.person.findMany({
      where: { uniqueName: user.email },
      select: { id: true },
    });
    const ids = new Set(me.map((p) => p.id));
    if (user.roles.includes('TeamLead') && ids.size > 0) {
      const myTeams = await this.prisma.teamMember.findMany({
        where: { personId: { in: [...ids] }, team: { projectId } },
        select: { teamId: true },
      });
      const members = await this.prisma.teamMember.findMany({
        where: { teamId: { in: myTeams.map((t) => t.teamId) } },
        select: { personId: true },
      });
      for (const m of members) ids.add(m.personId);
    }
    return { all: false, ids };
  }

  personRef(
    person: { id: string; displayName: string; uniqueName: string } | null | undefined,
    visibility: PersonVisibility,
  ): PersonRef | null {
    if (!person) return null;
    const canSee = visibility.all || visibility.ids.has(person.id);
    return {
      id: person.id,
      displayName: person.displayName,
      ...(canSee ? { email: person.uniqueName } : {}),
    };
  }

  async peopleById(
    ids: Iterable<string | null>,
  ): Promise<Map<string, { id: string; displayName: string; uniqueName: string }>> {
    const unique = [...new Set([...ids].filter((v): v is string => !!v))];
    if (unique.length === 0) return new Map();
    const rows = await this.prisma.person.findMany({ where: { id: { in: unique } } });
    return new Map(rows.map((p) => [p.id, p]));
  }

  /** The project's sprints that have both dates, oldest first. */
  async sprints(projectId: string): Promise<SprintWindow[]> {
    const its = await this.prisma.iteration.findMany({
      where: { projectId, startDate: { not: null }, finishDate: { not: null } },
      select: { path: true, startDate: true, finishDate: true },
      orderBy: { startDate: 'asc' },
    });
    return its.map((i) => ({ path: i.path, startDate: i.startDate!, finishDate: i.finishDate! }));
  }
}
