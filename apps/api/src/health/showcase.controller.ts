import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Names shown on the sign-in page before anyone signs in: the project, the team and the sprint
 * running now. Only names, never stories, people or numbers.
 */
@Controller('showcase')
@Public()
export class ShowcaseController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async current(): Promise<{ project: string | null; team: string | null; sprint: string | null }> {
    const now = new Date();
    const team = await this.prisma.team.findFirst({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, project: { select: { id: true, name: true } } },
    });
    if (!team) return { project: null, team: null, sprint: null };
    // The project's sprint covering today (the team's own sprint list is often out of date),
    // else the one that started most recently.
    const sprint =
      (await this.prisma.iteration.findFirst({
        where: { projectId: team.project.id, startDate: { lte: now }, finishDate: { gte: now } },
        orderBy: { startDate: 'desc' },
        select: { name: true },
      })) ??
      (await this.prisma.iteration.findFirst({
        where: { projectId: team.project.id, startDate: { lte: now } },
        orderBy: { startDate: 'desc' },
        select: { name: true },
      }));
    return { project: team.project.name, team: team.name, sprint: sprint?.name ?? null };
  }
}
