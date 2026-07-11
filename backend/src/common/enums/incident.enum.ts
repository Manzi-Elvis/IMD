export enum IncidentSeverity {
  SEV1 = 'sev1', // critical: full outage, all-hands
  SEV2 = 'sev2', // major: significant degradation
  SEV3 = 'sev3', // minor: limited impact
  SEV4 = 'sev4', // cosmetic / low urgency
}

// The full lifecycle. Order matters — it's used to validate forward transitions.
export enum IncidentStatus {
  OPEN = 'open',
  INVESTIGATING = 'investigating',
  IDENTIFIED = 'identified',
  MONITORING = 'monitoring',
  RESOLVED = 'resolved',
  POSTMORTEM = 'postmortem',
}

// Timeline entry types — every mutation to an incident produces one of these,
// which is what makes the incident auditable/searchable later.
export enum IncidentEventType {
  CREATED = 'created',
  STATUS_CHANGE = 'status_change',
  SEVERITY_CHANGE = 'severity_change',
  ASSIGNMENT_CHANGE = 'assignment_change',
  COMMENT = 'comment',
  ATTACHMENT_ADDED = 'attachment_added',
}
