// Roles are deliberately coarse-grained (4 roles) rather than a full permissions
// matrix — this is the right level of complexity for a team-sized incident tool.
// If this grows, replace with a Permission[] model instead of adding more roles.
export enum Role {
  ADMIN = 'admin', // full access, manages users
  ON_CALL_ENGINEER = 'on_call_engineer', // can change severity, own/close incidents
  RESPONDER = 'responder', // can comment, upload evidence, cannot change severity/close
  VIEWER = 'viewer', // read-only
}
