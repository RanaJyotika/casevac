/**
 * Input validation for registration and edit forms.
 * All inputs arrive as strings (from FormData) and are normalised here so the
 * same rules apply to server actions, tests and any future API.
 */
import { isRoleId, ROLE_DEFINITIONS } from "./roles";
import type {
  BloodGroup,
  RecordStatus,
  RhFactor,
  RoleId,
  Sex,
  SoldierDetails,
} from "./types";

export type FieldErrors = Record<string, string>;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: FieldErrors };

export const SEX_OPTIONS: Record<Sex, string> = {
  NOT_RECORDED: "Not recorded",
  MALE: "Male",
  FEMALE: "Female",
};
export const BLOOD_GROUP_OPTIONS: Record<BloodGroup, string> = {
  UNKNOWN: "Unknown",
  A: "A",
  B: "B",
  AB: "AB",
  O: "O",
};
export const RH_OPTIONS: Record<RhFactor, string> = {
  UNKNOWN: "Unknown",
  POSITIVE: "Positive (+)",
  NEGATIVE: "Negative (−)",
};
export const STATUS_OPTIONS: Record<RecordStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
};

const NAME_PATTERN = /^[\p{L}][\p{L} .'-]*$/u;
const SERVICE_NUMBER_PATTERN = /^[A-Z0-9][A-Z0-9/-]*$/;
const PHONE_PATTERN = /^\+?[0-9 ()-]{6,20}$/;

function clean(value: string | undefined | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function normaliseServiceNumber(value: string): string {
  return clean(value).toUpperCase();
}

function oneOf<T extends string>(
  value: string,
  options: Record<T, string>,
  fallback: T,
): T | null {
  if (value === "") return fallback;
  return value in options ? (value as T) : null;
}

class Collector {
  errors: FieldErrors = {};

  text(
    field: string,
    raw: string | undefined,
    opts: { label: string; required?: boolean; min?: number; max: number; pattern?: RegExp; patternMessage?: string },
  ): string {
    const value = clean(raw);
    if (!value) {
      if (opts.required) this.errors[field] = `${opts.label} is required.`;
      return "";
    }
    if (opts.min && value.length < opts.min) {
      this.errors[field] = `${opts.label} must be at least ${opts.min} characters.`;
    } else if (value.length > opts.max) {
      this.errors[field] = `${opts.label} must be ${opts.max} characters or fewer.`;
    } else if (opts.pattern && !opts.pattern.test(value)) {
      this.errors[field] = opts.patternMessage ?? `${opts.label} has an invalid format.`;
    }
    return value;
  }

  name(field: string, raw: string | undefined, label: string, required: boolean): string {
    return this.text(field, raw, {
      label,
      required,
      min: 2,
      max: 100,
      pattern: NAME_PATTERN,
      patternMessage: `${label} may contain letters, spaces, apostrophes, full stops and hyphens only.`,
    });
  }

  phone(field: string, raw: string | undefined, label: string): string {
    return this.text(field, raw, {
      label,
      max: 20,
      pattern: PHONE_PATTERN,
      patternMessage: `${label} must be 6–20 digits (spaces, +, -, brackets allowed).`,
    });
  }

  serviceNumber(raw: string | undefined): string {
    const value = normaliseServiceNumber(raw ?? "");
    if (!value) {
      this.errors.serviceNumber = "Service number is required.";
    } else if (value.length < 3 || value.length > 30) {
      this.errors.serviceNumber = "Service number must be 3–30 characters.";
    } else if (!SERVICE_NUMBER_PATTERN.test(value)) {
      this.errors.serviceNumber = "Use letters, digits, hyphens or slashes only.";
    }
    return value;
  }

  choice<T extends string>(field: string, raw: string | undefined, options: Record<T, string>, fallback: T, label: string): T {
    const value = oneOf(clean(raw), options, fallback);
    if (value === null) {
      this.errors[field] = `Select a valid ${label.toLowerCase()}.`;
      return fallback;
    }
    return value;
  }

  get ok(): boolean {
    return Object.keys(this.errors).length === 0;
  }
}

function validateDateOfBirth(c: Collector, raw: string | undefined): string | null {
  const value = clean(raw);
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    c.errors.dateOfBirth = "Enter a valid date.";
    return null;
  }
  const dob = new Date(`${value}T00:00:00Z`);
  const now = new Date();
  if (dob > now) {
    c.errors.dateOfBirth = "Date of birth cannot be in the future.";
  } else if (dob.getUTCFullYear() < 1940) {
    c.errors.dateOfBirth = "Date of birth looks incorrect.";
  }
  return value;
}

/* ---------------------------- Soldier ---------------------------- */

export interface SoldierInput {
  fullName?: string;
  serviceNumber?: string;
  rank?: string;
  unit?: string;
  dateOfBirth?: string;
  sex?: string;
  bloodGroup?: string;
  rhFactor?: string;
  medicalCategory?: string;
  identificationMarks?: string;
  nextOfKinName?: string;
  nextOfKinRelationship?: string;
  nextOfKinPhone?: string;
  contactPhone?: string;
  status?: string;
  /** JPEG data URL produced by the form's photo field, or empty. */
  photo?: string;
}

/** Upper bound for a stored ID photo data URL (≈ 48 KB of JPEG). */
export const PHOTO_MAX_LENGTH = 65_000;
const PHOTO_PATTERN = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;

function validatePhoto(c: { errors: Record<string, string> }, raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (value.length > PHOTO_MAX_LENGTH || !PHOTO_PATTERN.test(value)) {
    c.errors.photo = "The photo could not be saved. Choose it again (JPEG or PNG).";
    return null;
  }
  return value;
}

export interface ValidSoldier {
  fullName: string;
  serviceNumber: string;
  rank: string;
  unit: string;
  contactPhone: string;
  status: RecordStatus;
  soldier: SoldierDetails;
}

export function validateSoldier(input: SoldierInput, opts: { requireServiceNumber: boolean } = { requireServiceNumber: true }): ValidationResult<ValidSoldier> {
  const c = new Collector();
  const fullName = c.name("fullName", input.fullName, "Full name", true);
  const serviceNumber = opts.requireServiceNumber ? c.serviceNumber(input.serviceNumber) : "";
  const rank = c.text("rank", input.rank, { label: "Rank", required: true, max: 40 });
  const unit = c.text("unit", input.unit, { label: "Unit / formation", required: true, max: 80 });
  const dateOfBirth = validateDateOfBirth(c, input.dateOfBirth);
  const sex = c.choice("sex", input.sex, SEX_OPTIONS, "NOT_RECORDED", "Sex");
  const bloodGroup = c.choice("bloodGroup", input.bloodGroup, BLOOD_GROUP_OPTIONS, "UNKNOWN", "Blood group");
  const rhFactor = c.choice("rhFactor", input.rhFactor, RH_OPTIONS, "UNKNOWN", "Rh factor");
  const medicalCategory = c.text("medicalCategory", input.medicalCategory, { label: "Medical category", max: 40 });
  const identificationMarks = c.text("identificationMarks", input.identificationMarks, { label: "Identification marks", max: 200 });
  const nokName = c.name("nextOfKinName", input.nextOfKinName, "Next of kin name", false);
  const nokRel = c.text("nextOfKinRelationship", input.nextOfKinRelationship, { label: "Relationship", max: 40 });
  const nokPhone = c.phone("nextOfKinPhone", input.nextOfKinPhone, "Next of kin phone");
  const contactPhone = c.phone("contactPhone", input.contactPhone, "Contact phone");
  const status = c.choice("status", input.status, STATUS_OPTIONS, "ACTIVE", "Status");
  const photo = validatePhoto(c, input.photo);

  if ((nokRel || nokPhone) && !nokName) {
    c.errors.nextOfKinName = "Enter the next of kin name, or clear the other next-of-kin fields.";
  }

  if (!c.ok) return { ok: false, errors: c.errors };
  return {
    ok: true,
    value: {
      fullName,
      serviceNumber,
      rank,
      unit,
      contactPhone,
      status,
      soldier: {
        dateOfBirth,
        sex,
        bloodGroup,
        rhFactor,
        medicalCategory,
        identificationMarks,
        nextOfKin: { name: nokName, relationship: nokRel, phone: nokPhone },
        photo,
      },
    },
  };
}

/* ----------------------------- Staff ----------------------------- */

export interface StaffInput {
  fullName?: string;
  serviceNumber?: string;
  rank?: string;
  unit?: string;
  role?: string;
  designation?: string;
  professionalRegistration?: string;
  contactPhone?: string;
  status?: string;
  teamId?: string;
}

export interface ValidStaff {
  fullName: string;
  serviceNumber: string;
  rank: string;
  unit: string;
  contactPhone: string;
  status: RecordStatus;
  role: RoleId;
  designation: string;
  professionalRegistration: string;
  teamId: string | null;
}

export function validateStaff(input: StaffInput, opts: { requireServiceNumber: boolean } = { requireServiceNumber: true }): ValidationResult<ValidStaff> {
  const c = new Collector();
  const fullName = c.name("fullName", input.fullName, "Full name", true);
  const serviceNumber = opts.requireServiceNumber ? c.serviceNumber(input.serviceNumber) : "";
  const rank = c.text("rank", input.rank, { label: "Rank", required: true, max: 40 });
  const unit = c.text("unit", input.unit, { label: "Unit / facility", required: true, max: 80 });
  const roleRaw = clean(input.role);
  let role: RoleId = "MEDIC";
  if (!roleRaw) {
    c.errors.role = "Select a role.";
  } else if (!isRoleId(roleRaw)) {
    c.errors.role = "Select a valid role.";
  } else {
    role = roleRaw;
  }
  const designation = c.text("designation", input.designation, {
    label: "Designation",
    required: role === "MEDICAL_OFFICER",
    max: 60,
  });
  const professionalRegistration = c.text("professionalRegistration", input.professionalRegistration, {
    label: "Professional registration",
    max: 60,
  });
  const contactPhone = c.phone("contactPhone", input.contactPhone, "Contact phone");
  const status = c.choice("status", input.status, STATUS_OPTIONS, "ACTIVE", "Status");
  const teamId = clean(input.teamId) || null;
  if (teamId && isRoleId(roleRaw) && !ROLE_DEFINITIONS[role].teamEligible) {
    c.errors.teamId = `${ROLE_DEFINITIONS[role].label} cannot be assigned to a medical team.`;
  }

  if (!c.ok) return { ok: false, errors: c.errors };
  return {
    ok: true,
    value: { fullName, serviceNumber, rank, unit, contactPhone, status, role, designation, professionalRegistration, teamId },
  };
}

/* ------------------------------ Team ----------------------------- */

export interface TeamInput {
  name?: string;
  unit?: string;
  description?: string;
  leaderId?: string;
  status?: string;
}

export interface ValidTeam {
  name: string;
  unit: string;
  description: string;
  leaderId: string | null;
  status: RecordStatus;
}

export function validateTeam(input: TeamInput): ValidationResult<ValidTeam> {
  const c = new Collector();
  const name = c.text("name", input.name, { label: "Team name", required: true, min: 3, max: 60 });
  const unit = c.text("unit", input.unit, { label: "Unit", max: 80 });
  const description = c.text("description", input.description, { label: "Description", max: 200 });
  const leaderId = clean(input.leaderId) || null;
  const status = c.choice("status", input.status, STATUS_OPTIONS, "ACTIVE", "Status");
  if (!c.ok) return { ok: false, errors: c.errors };
  return { ok: true, value: { name, unit, description, leaderId, status } };
}

/* ------------------------ Revocation reason ---------------------- */

export function validateReason(raw: string | undefined): ValidationResult<string> {
  const c = new Collector();
  const reason = c.text("reason", raw, { label: "Reason", required: true, min: 3, max: 200 });
  if (!c.ok) return { ok: false, errors: c.errors };
  return { ok: true, value: reason };
}
