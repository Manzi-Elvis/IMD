import { BadRequestException } from '@nestjs/common';
import { IncidentStatus } from '../common/enums/incident.enum';

/**
 * The incident lifecycle modeled as an explicit state machine.
 *
 * Why this exists as its own class rather than inline `if` checks in the
 * service: the allowed-transitions map is the single source of truth for
 * "what can happen next", so the API, the frontend status dropdown, and any
 * future automation (e.g. auto-closing stale incidents) all read from the
 * same place instead of re-deriving the rules.
 *
 * Postgres backs this up with a CHECK constraint on the enum type itself
 * (see migrations) — that guarantees the column can never hold a garbage
 * value even if a bug bypasses this class. This class is what enforces the
 * *order* of transitions; the DB constraint only enforces *membership*.
 */
export class IncidentStateMachine {
  private static readonly transitions: Record<IncidentStatus, IncidentStatus[]> = {
    [IncidentStatus.OPEN]: [IncidentStatus.INVESTIGATING],
    [IncidentStatus.INVESTIGATING]: [IncidentStatus.IDENTIFIED, IncidentStatus.OPEN],
    [IncidentStatus.IDENTIFIED]: [IncidentStatus.MONITORING, IncidentStatus.INVESTIGATING],
    [IncidentStatus.MONITORING]: [IncidentStatus.RESOLVED, IncidentStatus.IDENTIFIED],
    [IncidentStatus.RESOLVED]: [IncidentStatus.POSTMORTEM, IncidentStatus.MONITORING],
    // Postmortem is terminal — reopening a fully written-up incident should be
    // a new incident, not a status flip, so no forward transitions from here.
    [IncidentStatus.POSTMORTEM]: [],
  };

  static assertValidTransition(from: IncidentStatus, to: IncidentStatus): void {
    if (from === to) {
      throw new BadRequestException(`Incident is already in status "${from}"`);
    }
    const allowed = this.transitions[from] ?? [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Invalid transition: cannot move from "${from}" to "${to}". ` +
          `Allowed next states: ${allowed.length ? allowed.join(', ') : 'none (terminal state)'}`,
      );
    }
  }

  static nextStates(from: IncidentStatus): IncidentStatus[] {
    return this.transitions[from] ?? [];
  }
}