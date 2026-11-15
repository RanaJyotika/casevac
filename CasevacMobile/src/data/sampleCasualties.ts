/**
 * SYNTHETIC DEMONSTRATION DATA ONLY — fictional casualties for client demos.
 *
 * Loaded on the tablet only when the client-demo account (MED-DEMO-02) signs
 * in (see services/demo/sampleCasualties.ts). The demo account MED-DEMO-01
 * still starts from an empty tablet.
 *
 * The six named soldiers are registered in the dashboard by
 * `npm run demo:patients` (admin-dashboard/scripts/seed-demo-patients.ts),
 * which also issues their signed QR wristbands. They are matched here by full
 * name — keep both lists in step. If a soldier is not in the tablet's
 * directory, they are field-registered under `fallbackTempId` instead, so the
 * demo always works.
 *
 * Times are minutes before the moment the samples are loaded, so the
 * dashboard always looks current. Clinical content is illustrative, not
 * clinical guidance.
 */
import type { TriageCategory } from '../types';
import type { BloodGroup, RhFactor, Sex } from '../services/identity/types';
import type { MarchKey, SystemicExam } from '../services/evacuation/assessment';
import type { YesNoNa } from '../services/evacuation/interventions';
import type { NextAction, Place } from '../services/evacuation/handover';
import type { EvacuationMode } from '../services/evacuation/evacuation';

export interface SampleEpisode {
  /** Suffix for the record IDs (ASM-DEMO-<id>, INT-DEMO-<id>, …). */
  id: string;
  /** Time of injury. */
  injuredMinAgo: number;
  /** Who recorded it; null = the medic who loaded the samples. */
  recordedBy: string | null;
  assessment: {
    minAgo: number;
    conscious: boolean;
    mechanisms: string[];
    injuryCount: number | null;
    status: TriageCategory | null;
    march: MarchKey[];
    additionalInjury: string;
    hr: number | null;
    rr: number | null;
    bp: [number, number] | null;
    spo2: number | null;
    temp: number | null;
    systemicExam: SystemicExam | null;
    rs?: string;
    cvs?: string;
    pa?: string;
    cns?: string;
    additionalInfo: string;
  };
  interventions?: {
    minAgo: number;
    bleedingMethods: string[];
    tourniquetMinAgo?: number;
    airway: boolean | null;
    breathing: boolean | null;
    splinting: boolean | null;
    oxygen: YesNoNa | null;
    medications: { name: string; dose: string; minAgo: number | null }[];
    category: TriageCategory;
    injuryLocations: string[];
    provisionalDiagnosis: string;
    remarks: string;
  };
  handover?: {
    minAgo: number;
    initiatedMinAgo: number;
    place: Place;
    /** Full name of a clinician in the tablet's staff list. */
    officerName: string;
    /** Used when that clinician is not on this tablet's staff list. */
    officerFallback: { rank: string; displayId: string; unit: string; designation: string };
    nextAction: NextAction;
  };
  evacuation?: {
    minAgo: number;
    evacuatedMinAgo: number;
    assistedByMo: boolean;
    assistedByNa: boolean;
    condition: TriageCategory;
    conditionNotes: string;
    mode: EvacuationMode;
  };
}

export interface SampleCasualty {
  /** null = unidentified casualty (always field-registered). */
  fullName: string | null;
  rank: string;
  unit: string;
  sex: Sex;
  bloodGroup: BloodGroup;
  rhFactor: RhFactor;
  /** For a field registration (directory patients show age from DOB). */
  age: number | null;
  /** TEMP- ID used when the soldier is not in the directory. */
  fallbackTempId: string;
  /** Oldest first; the last one is the current evacuation. */
  episodes: SampleEpisode[];
}

const DAY = 24 * 60;

const KAPOOR = {
  officerName: 'Neha Kapoor',
  officerFallback: {
    rank: 'Major',
    displayId: 'DOC-00001',
    unit: 'Forward Surgical Centre',
    designation: 'Surgeon, FSC',
  },
};
const RAO = {
  officerName: 'Aditya Rao',
  officerFallback: {
    rank: 'Captain',
    displayId: 'DOC-00002',
    unit: 'Advanced Dressing Station',
    designation: 'Medical Officer, ADS',
  },
};
const PATIL = {
  officerName: 'Suresh Patil',
  officerFallback: {
    rank: 'Havildar',
    displayId: 'MED-00001',
    unit: 'Regimental Aid Post',
    designation: 'Nursing Assistant',
  },
};

export const SAMPLE_CASUALTIES: readonly SampleCasualty[] = [
  /* 1 — RED, blast: treated, handed over at FSC, in transit. */
  {
    fullName: 'Vikram Singh',
    rank: 'Sepoy',
    unit: 'Alpha',
    sex: 'MALE',
    bloodGroup: 'B',
    rhFactor: 'POSITIVE',
    age: 27,
    fallbackTempId: 'TEMP-DEMAA2',
    episodes: [
      {
        id: '01',
        injuredMinAgo: 95,
        recordedBy: null,
        assessment: {
          minAgo: 88,
          conscious: true,
          mechanisms: ['Blast / IED', 'Fragmentation'],
          injuryCount: 3,
          status: 'RED',
          march: ['M', 'R', 'C'],
          additionalInjury:
            'Partial amputation left leg below knee; fragment wounds right chest and left thigh.',
          hr: 132,
          rr: 28,
          bp: [88, 54],
          spo2: 89,
          temp: 36.1,
          systemicExam: 'RECORDABLE',
          rs: 'Reduced air entry right side',
          cvs: 'Tachycardic, weak radial pulse',
          pa: 'Soft, non-tender',
          cns: 'GCS 14, oriented',
          additionalInfo: 'IED strike on foot patrol near checkpoint 4.',
        },
        interventions: {
          minAgo: 80,
          bleedingMethods: ['Tourniquet', 'Wound packing'],
          tourniquetMinAgo: 90,
          airway: true,
          breathing: true,
          splinting: true,
          oxygen: 'YES',
          medications: [
            { name: 'Tranexamic acid', dose: '1 g IV', minAgo: 84 },
            { name: 'Morphine', dose: '10 mg IM', minAgo: 82 },
            { name: 'Ceftriaxone', dose: '1 g IV', minAgo: 81 },
          ],
          category: 'RED',
          injuryLocations: ['LLL-F', 'THL-F', 'CHR-F'],
          provisionalDiagnosis:
            'Blast injury, traumatic partial amputation left leg, haemorrhagic shock, suspected right haemothorax',
          remarks: 'Chest seal applied right side. Tourniquet re-checked, holding.',
        },
        handover: {
          minAgo: 35,
          initiatedMinAgo: 40,
          place: 'FSC',
          ...KAPOOR,
          nextAction: 'EVACUATE_HIGHER',
        },
      },
    ],
  },

  /* 2 — RED, gunshot: treated, awaiting pickup (raises the RED alert). One
     earlier, completed evacuation shows in his previous history. */
  {
    fullName: 'Rohit Yadav',
    rank: 'Naik',
    unit: 'Bravo',
    sex: 'MALE',
    bloodGroup: 'O',
    rhFactor: 'POSITIVE',
    age: 31,
    fallbackTempId: 'TEMP-DEMBB2',
    episodes: [
      {
        id: '02A',
        injuredMinAgo: 41 * DAY + 190,
        recordedBy: 'MED-DEMO-01',
        assessment: {
          minAgo: 41 * DAY + 180,
          conscious: true,
          mechanisms: ['Fall'],
          injuryCount: 1,
          status: 'GREEN',
          march: [],
          additionalInjury: 'Twisted right ankle on rocky slope.',
          hr: 88,
          rr: 16,
          bp: [124, 80],
          spo2: 98,
          temp: 36.8,
          systemicExam: 'NOT_RECORDABLE',
          additionalInfo: '',
        },
        interventions: {
          minAgo: 41 * DAY + 170,
          bleedingMethods: [],
          airway: null,
          breathing: null,
          splinting: true,
          oxygen: 'NA',
          medications: [{ name: 'Paracetamol', dose: '1 g PO', minAgo: 41 * DAY + 172 }],
          category: 'GREEN',
          injuryLocations: ['FTR-F'],
          provisionalDiagnosis: 'Sprain right ankle',
          remarks: '',
        },
        handover: {
          minAgo: 41 * DAY + 120,
          initiatedMinAgo: 41 * DAY + 125,
          place: 'RAP',
          ...PATIL,
          nextAction: 'CONTINUE_AT_RAP',
        },
        evacuation: {
          minAgo: 41 * DAY + 110,
          evacuatedMinAgo: 41 * DAY + 112,
          assistedByMo: false,
          assistedByNa: true,
          condition: 'GREEN',
          conditionNotes: 'Walking wounded with support.',
          mode: 'STRETCHER',
        },
      },
      {
        id: '02',
        injuredMinAgo: 50,
        recordedBy: null,
        assessment: {
          minAgo: 44,
          conscious: true,
          mechanisms: ['Gunshot'],
          injuryCount: 2,
          status: 'RED',
          march: ['M', 'C'],
          additionalInjury: 'Through-and-through GSW right thigh; graze left flank.',
          hr: 124,
          rr: 24,
          bp: [96, 60],
          spo2: 95,
          temp: 36.4,
          systemicExam: 'RECORDABLE',
          rs: 'Clear, equal air entry',
          cvs: 'Tachycardic',
          pa: 'Tender left flank, no guarding',
          cns: 'GCS 15',
          additionalInfo: 'Sniper fire during convoy halt.',
        },
        interventions: {
          minAgo: 36,
          bleedingMethods: ['Tourniquet', 'Pressure bandage'],
          tourniquetMinAgo: 47,
          airway: false,
          breathing: false,
          splinting: true,
          oxygen: 'NO',
          medications: [
            { name: 'Tranexamic acid', dose: '1 g IV', minAgo: 40 },
            { name: 'Fentanyl', dose: '50 mcg IV', minAgo: 39 },
          ],
          category: 'RED',
          injuryLocations: ['THR-F', 'THR-B', 'ABL-F'],
          provisionalDiagnosis: 'GSW right thigh with suspected femoral fracture; soft-tissue wound left flank',
          remarks: 'Distal pulses absent below tourniquet. Needs surgical evacuation.',
        },
      },
    ],
  },

  /* 3 — YELLOW, burns: complete, handed over by helicopter. */
  {
    fullName: 'Sunita Rawat',
    rank: 'Lance Naik',
    unit: 'Charlie',
    sex: 'FEMALE',
    bloodGroup: 'A',
    rhFactor: 'NEGATIVE',
    age: 29,
    fallbackTempId: 'TEMP-DEMCC2',
    episodes: [
      {
        id: '03',
        injuredMinAgo: 240,
        recordedBy: null,
        assessment: {
          minAgo: 232,
          conscious: true,
          mechanisms: ['Burn'],
          injuryCount: 2,
          status: 'YELLOW',
          march: ['A', 'H'],
          additionalInjury: 'Partial-thickness burns both forearms and front of chest (~14% TBSA).',
          hr: 108,
          rr: 20,
          bp: [118, 76],
          spo2: 96,
          temp: 36.3,
          systemicExam: 'RECORDABLE',
          rs: 'No stridor, no soot in airway',
          cvs: 'Normal',
          pa: 'Normal',
          cns: 'GCS 15',
          additionalInfo: 'Fuel fire at vehicle park.',
        },
        interventions: {
          minAgo: 225,
          bleedingMethods: [],
          airway: true,
          breathing: false,
          splinting: false,
          oxygen: 'YES',
          medications: [
            { name: 'Ringer lactate', dose: '1 L IV', minAgo: 226 },
            { name: 'Morphine', dose: '5 mg IV', minAgo: 224 },
          ],
          category: 'YELLOW',
          injuryLocations: ['FAR-F', 'FAL-F', 'CHR-F', 'CHL-F'],
          provisionalDiagnosis: 'Partial-thickness burns ~14% TBSA, no inhalation injury',
          remarks: 'Burns covered with cling film; kept warm.',
        },
        handover: {
          minAgo: 190,
          initiatedMinAgo: 195,
          place: 'ADS',
          ...RAO,
          nextAction: 'EVACUATE_HIGHER',
        },
        evacuation: {
          minAgo: 180,
          evacuatedMinAgo: 182,
          assistedByMo: true,
          assistedByNa: true,
          condition: 'YELLOW',
          conditionNotes: 'Stable on transfer, pain controlled.',
          mode: 'HELICOPTER',
        },
      },
    ],
  },

  /* 4 — YELLOW, vehicle accident: complete, handed over by ambulance;
     recorded by another medic (shows under "All on tablet"). */
  {
    fullName: 'Manpreet Gill',
    rank: 'Havildar',
    unit: 'Delta',
    sex: 'MALE',
    bloodGroup: 'AB',
    rhFactor: 'POSITIVE',
    age: 38,
    fallbackTempId: 'TEMP-DEMDD2',
    episodes: [
      {
        id: '04',
        injuredMinAgo: 300,
        recordedBy: 'MED-DEMO-01',
        assessment: {
          minAgo: 292,
          conscious: true,
          mechanisms: ['Vehicle accident'],
          injuryCount: 2,
          status: 'YELLOW',
          march: ['C'],
          additionalInjury: 'Deformity left forearm; seat-belt bruising across chest.',
          hr: 102,
          rr: 18,
          bp: [132, 84],
          spo2: 97,
          temp: 36.7,
          systemicExam: 'RECORDABLE',
          rs: 'Tender left chest wall, air entry equal',
          cvs: 'Normal',
          pa: 'Soft',
          cns: 'GCS 15',
          additionalInfo: 'Light vehicle rolled over on mountain road.',
        },
        interventions: {
          minAgo: 284,
          bleedingMethods: [],
          airway: false,
          breathing: false,
          splinting: true,
          oxygen: 'NO',
          medications: [{ name: 'Diclofenac', dose: '75 mg IM', minAgo: 285 }],
          category: 'YELLOW',
          injuryLocations: ['FAL-F', 'CHL-F'],
          provisionalDiagnosis: 'Closed fracture left forearm; chest wall contusion',
          remarks: 'Splinted in SAM splint, distal neurovascular intact.',
        },
        handover: {
          minAgo: 245,
          initiatedMinAgo: 250,
          place: 'ADS',
          ...RAO,
          nextAction: 'NEXT_ECHELON',
        },
        evacuation: {
          minAgo: 230,
          evacuatedMinAgo: 232,
          assistedByMo: false,
          assistedByNa: true,
          condition: 'YELLOW',
          conditionNotes: '',
          mode: 'AMBULANCE',
        },
      },
    ],
  },

  /* 5 — GREEN, fall: assessment only, next step Interventions. */
  {
    fullName: 'Imran Khan',
    rank: 'Sepoy',
    unit: 'Echo',
    sex: 'MALE',
    bloodGroup: 'B',
    rhFactor: 'NEGATIVE',
    age: 26,
    fallbackTempId: 'TEMP-DEMEE2',
    episodes: [
      {
        id: '05',
        injuredMinAgo: 25,
        recordedBy: null,
        assessment: {
          minAgo: 18,
          conscious: true,
          mechanisms: ['Fall'],
          injuryCount: 2,
          status: 'GREEN',
          march: [],
          additionalInjury: 'Laceration over right knee; painful left wrist.',
          hr: 92,
          rr: 16,
          bp: [126, 82],
          spo2: 99,
          temp: 36.9,
          systemicExam: 'NOT_RECORDABLE',
          additionalInfo: 'Fell about 2 m from bunker wall.',
        },
      },
    ],
  },

  /* 6 — YELLOW, fragmentation: complete, stretcher to RAP; recorded by
     another medic. */
  {
    fullName: 'Deepak Thapa',
    rank: 'Rifleman',
    unit: 'Foxtrot',
    sex: 'MALE',
    bloodGroup: 'O',
    rhFactor: 'NEGATIVE',
    age: 28,
    fallbackTempId: 'TEMP-DEMFF2',
    episodes: [
      {
        id: '06',
        injuredMinAgo: 150,
        recordedBy: 'MED-DEMO-01',
        assessment: {
          minAgo: 143,
          conscious: true,
          mechanisms: ['Fragmentation'],
          injuryCount: 1,
          status: 'YELLOW',
          march: ['M'],
          additionalInjury: 'Fragment wound left shoulder, bleeding controlled.',
          hr: 110,
          rr: 20,
          bp: [114, 72],
          spo2: 97,
          temp: 36.5,
          systemicExam: 'RECORDABLE',
          rs: 'Clear',
          cvs: 'Tachycardic',
          pa: 'Normal',
          cns: 'GCS 15',
          additionalInfo: 'Mortar round landed near sentry post.',
        },
        interventions: {
          minAgo: 135,
          bleedingMethods: ['Direct pressure', 'Pressure bandage'],
          airway: false,
          breathing: false,
          splinting: false,
          oxygen: 'NO',
          medications: [
            { name: 'Tetanus toxoid', dose: '0.5 ml IM', minAgo: 136 },
            { name: 'Diclofenac', dose: '75 mg IM', minAgo: 134 },
          ],
          category: 'YELLOW',
          injuryLocations: ['SHL-F', 'SHL-B'],
          provisionalDiagnosis: 'Penetrating fragment wound left shoulder, retained fragment',
          remarks: 'Arm in sling.',
        },
        handover: {
          minAgo: 110,
          initiatedMinAgo: 115,
          place: 'RAP',
          ...PATIL,
          nextAction: 'CONTINUE_AT_RAP',
        },
        evacuation: {
          minAgo: 100,
          evacuatedMinAgo: 102,
          assistedByMo: false,
          assistedByNa: true,
          condition: 'YELLOW',
          conditionNotes: 'Bleeding controlled.',
          mode: 'STRETCHER',
        },
      },
    ],
  },

  /* 7 — RED, unidentified and unconscious: field-registered, assessment
     only, next step Interventions. */
  {
    fullName: null,
    rank: '',
    unit: '',
    sex: 'MALE',
    bloodGroup: 'UNKNOWN',
    rhFactor: 'UNKNOWN',
    age: null,
    fallbackTempId: 'TEMP-X7KQ2M',
    episodes: [
      {
        id: '07',
        injuredMinAgo: 14,
        recordedBy: null,
        assessment: {
          minAgo: 6,
          conscious: false,
          mechanisms: ['Crush', 'Blast / IED'],
          injuryCount: null,
          status: 'RED',
          march: ['A', 'R', 'H'],
          additionalInjury: 'Trapped under collapsed wall; no wristband, no ID card.',
          hr: 58,
          rr: 8,
          bp: [84, 50],
          spo2: 86,
          temp: 35.4,
          systemicExam: 'RECORDABLE',
          rs: 'Shallow breathing, reduced air entry both sides',
          cvs: 'Bradycardic',
          pa: 'Distended',
          cns: 'GCS 7, right pupil sluggish',
          additionalInfo: 'Found by search party after building collapse.',
        },
      },
    ],
  },
];
