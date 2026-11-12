/**
 * Predefined MVP roles and permissions.
 * Extend by adding a RoleId in types.ts and an entry here. Administrative
 * roles never receive clinical permissions automatically.
 *
 * NOTE: Dashboard enforcement is server-side per action, but credentials for
 * these roles are NOT issued in the MVP (demo admin sign-in only).
 */
import type { PersonCategory, RoleId } from "./types";

export type Permission =
  | "personnel.view"
  | "personnel.manage"
  | "identity.manage"
  | "teams.manage"
  | "system.configure"
  | "clinical.record"
  | "clinical.handover";

export const PERMISSIONS: Record<
  Permission,
  { label: string; surface: "Dashboard" | "Mobile app" }
> = {
  "personnel.view": { label: "View personnel records", surface: "Dashboard" },
  "personnel.manage": { label: "Register and edit personnel", surface: "Dashboard" },
  "identity.manage": { label: "Issue, reissue and revoke QR", surface: "Dashboard" },
  "teams.manage": { label: "Create and manage medical teams", surface: "Dashboard" },
  "system.configure": { label: "System settings and demo data", surface: "Dashboard" },
  "clinical.record": { label: "Record casualty care events", surface: "Mobile app" },
  "clinical.handover": { label: "Prepare / acknowledge handover", surface: "Mobile app" },
};

export interface RoleDefinition {
  id: RoleId;
  label: string;
  category: Exclude<PersonCategory, "SOLDIER">;
  clinical: boolean;
  /** May be a member of a medical team. */
  teamEligible: boolean;
  description: string;
  permissions: Permission[];
}

export const ROLE_DEFINITIONS: Record<RoleId, RoleDefinition> = {
  MEDIC: {
    id: "MEDIC",
    label: "Medic",
    category: "MEDIC",
    clinical: true,
    teamEligible: true,
    description: "Documents casualty care during evacuation (Team A / B).",
    permissions: ["clinical.record", "clinical.handover"],
  },
  MEDICAL_OFFICER: {
    id: "MEDICAL_OFFICER",
    label: "Doctor / Medical Officer",
    category: "DOCTOR",
    clinical: true,
    teamEligible: true,
    description: "Medical officer; records care and receives handover.",
    permissions: ["clinical.record", "clinical.handover"],
  },
  TEAM_LEADER: {
    id: "TEAM_LEADER",
    label: "Medical Team Leader",
    category: "STAFF",
    clinical: true,
    teamEligible: true,
    description: "Leads a medical team; clinical documentation within the team.",
    permissions: ["clinical.record", "clinical.handover", "personnel.view"],
  },
  EVAC_TEAM_MEMBER: {
    id: "EVAC_TEAM_MEMBER",
    label: "Evacuation Team Member",
    category: "STAFF",
    clinical: false,
    teamEligible: true,
    description: "Supports evacuation; no clinical record access by default.",
    permissions: [],
  },
  ADMIN_OFFICER: {
    id: "ADMIN_OFFICER",
    label: "Administrative Officer",
    category: "STAFF",
    clinical: false,
    teamEligible: false,
    description: "Registers personnel and issues QR wristbands. No clinical access.",
    permissions: ["personnel.view", "personnel.manage", "identity.manage", "teams.manage"],
  },
  SYSTEM_ADMIN: {
    id: "SYSTEM_ADMIN",
    label: "System Administrator",
    category: "STAFF",
    clinical: false,
    teamEligible: false,
    description: "Full dashboard administration. No clinical access.",
    permissions: [
      "personnel.view",
      "personnel.manage",
      "identity.manage",
      "teams.manage",
      "system.configure",
    ],
  },
};

export const ROLE_IDS = Object.keys(ROLE_DEFINITIONS) as RoleId[];

export function isRoleId(value: string): value is RoleId {
  return value in ROLE_DEFINITIONS;
}

export function roleLabel(role: RoleId): string {
  return ROLE_DEFINITIONS[role].label;
}

export const CATEGORY_LABELS: Record<PersonCategory, string> = {
  SOLDIER: "Soldier",
  MEDIC: "Medic",
  DOCTOR: "Doctor / MO",
  STAFF: "Other personnel",
};
