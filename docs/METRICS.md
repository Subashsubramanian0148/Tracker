# Metric definitions

Every number in the app is derived from Azure DevOps **revision history**: the full list of field
changes per work item. Revisions are immutable in Azure DevOps, so any metric can be recomputed
and audited. The engine lives in [`apps/api/src/metrics/engine`](../apps/api/src/metrics/engine) and is covered by unit tests.

States are mapped to Azure DevOps **state categories** (`Proposed`, `InProgress`, `Resolved`,
`Completed`, `Removed`) using each project's process metadata. Custom or inherited states
therefore work without code changes. For the Scrum process:

| State | Category |
|---|---|
| New, Approved | Proposed |
| Committed | InProgress |
| Done | Completed |
| Removed | Removed |

## Flow metrics

| Metric | Definition |
|---|---|
| **Activated** | First time the item entered an `InProgress` or `Resolved` state. |
| **Completed** | The *last* time the item entered a `Completed` state, if that is still its current state. |
| **Cycle time** | Completed − Activated. Measures how long the work actually took. |
| **Lead time** | Completed − Created. Measures how long the customer waited. |
| **Time in state** | Sum of time spent in each state, from state segments. Overview averages exclude Done/Removed. |
| **Throughput** | Count of items completed per ISO week (Monday 00:00 UTC). |
| **Reopened** | A transition from Resolved/Completed back to Proposed/InProgress. Cycle time still runs from the first activation. |
| **Blocked time** | Time with `Blocked = Yes` (Microsoft.VSTS.CMMI.Blocked) or a tag starting with `Blocked`. It stops counting at completion. |

Percentiles use linear interpolation (Excel `PERCENTILE.INC`). **P85** is the typical
"we finish 85% of items within X days" commitment figure.

By default, overview metrics cover backlog items (Product Backlog Item, User Story, Requirement and Bug).
Use the type filter to see other types.

## Estimate vs actual

- **Estimate (hours)** = `Original Estimate`. If that is empty, the first non-empty `Remaining Work` is used.
- **Actual (hours)** = `Completed Work`.
- **Ratio** = actual ÷ estimate. 1.0 is on estimate and above 1 took longer. An item counts as **on target** when its ratio is between 0.8 and 1.2.
- **Effort**: Scrum's `Effort` field is used as story points (falling back to `Story Points` or `Size`). The app shows both the initial and the current effort.

The Scrum process does not include `Original Estimate` or `Completed Work` on PBIs by default.
Teams that want hours-based accuracy should add those fields (inherited process) or log them on Tasks.

## Scope changes

A change counts as a **scope change** when it happens **after the item was activated**:

| Kind | Fields |
|---|---|
| Effort | Effort, Original Estimate |
| Requirement | Title, Description, Acceptance Criteria (bodies compared by hash; the first description isn't a change) |
| Sprint move | Iteration Path |
| Reassignment | Assigned To |

**Added mid-sprint** counts items that entered a sprint more than one day after it started.

## Sprint health

For each sprint, using iteration-path history:

| Measure | Definition |
|---|---|
| Committed | In the sprint at start + 1 day grace (planning often finishes on day one). |
| Added mid-sprint | Entered after the grace window, before the sprint ended. |
| Removed mid-sprint | Left the sprint before it ended without being completed. |
| Completed | Completed during the sprint while assigned to it. |
| Carried over | Still in the sprint at the end and not completed. |
| Completion rate | Completed committed items ÷ committed items. Added work does not inflate it. |

Sprint health counts backlog items only. Tasks are excluded.

## Delay detection

An item is **delayed** when at least one flag applies. Flags are re-evaluated after every sync.

| Flag | Rule |
|---|---|
| `CYCLE_TIME_OUTLIER` | Cycle time, or age since activation if still open, exceeds the project's P85 for that work item type over the last 180 days. Needs at least 5 completed items of that type. |
| `CARRIED_OVER` | The item was still in a sprint, unfinished, when that sprint ended. |
| `PAST_SPRINT_END` | The item isn't done and its current sprint ended more than a day ago. |
| `LONG_BLOCKED` | Blocked for longer than `DELAY_BLOCKED_HOURS` (default 48h). |
| `REOPENED` | Reopened at least once. |

Each delayed item can be given a **reason**: a category from an admin-managed list, a comment
and an estimated impact in days. Reasons are append-only. A new reason supersedes the old one and
history is kept. The item's assignee, Team Leads, Managers and Admins can add reasons.

## Data window

The sync pulls the last `SYNC_LOOKBACK_DAYS` (default 730) of revisions. For items created before
that window, the timeline starts at the window edge. The retention job removes items not changed in
`RETENTION_DAYS` (default 730).
