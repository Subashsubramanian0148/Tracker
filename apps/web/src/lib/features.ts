/**
 * Feature switches. Tasks mode (My tasks / Team tasks) is parked for now: its code, API and data
 * are kept, only hidden. Set to true here and re-enable TasksModule in apps/api/src/app.module.ts
 * to bring it back.
 */
export const TASKS_ENABLED = false;

/**
 * Slim view: each project shows just the Overview metrics and its Azure DevOps board. Sprints,
 * Delays and People are hidden (their code stays) and their links land on the board. Set to
 * false to restore every page.
 */
export const BOARD_ONLY = true;

/** Project sections shown while BOARD_ONLY is on, by tab label. */
export const SLIM_SECTIONS = ['Overview', 'Board'];

/** The page a project opens on. */
export const PROJECT_HOME = 'overview';
