import { Router } from 'express';
import * as oasisController from '../controllers/oasis.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../generated/prisma';

// ===========================================
// TYPE DEFINITIONS (kept for API documentation)
// ===========================================

// Assessment Types
export type OasisAssessmentType =
  | 'start_of_care' // SOC
  | 'resumption_of_care' // ROC
  | 'recertification' // Recert
  | 'follow_up' // FU
  | 'transfer_to_inpatient' // Transfer
  | 'discharge_from_agency' // DC
  | 'death_at_home'; // Death

export type AssessmentStatus =
  | 'draft'
  | 'in_progress'
  | 'pending_review'
  | 'needs_correction'
  | 'approved'
  | 'submitted'
  | 'locked';

// Main OASIS Assessment Entity
export interface OasisAssessment {
  id: string;
  patientId: string;
  episodeId: string;
  assessmentType: OasisAssessmentType;
  assessmentReason: string;
  status: AssessmentStatus;

  // Assessment dates
  dates: AssessmentDates;

  // All OASIS sections
  clinicalRecord: ClinicalRecordItems;
  patientTracking: PatientTrackingItems;
  patientHistory: PatientHistoryItems;
  livingSituation: LivingSituationItems;
  sensoryStatus: SensoryStatusItems;
  painAssessment: PainAssessmentItems;
  integumentaryStatus: IntegumentaryStatusItems;
  respiratoryStatus: RespiratoryStatusItems;
  cardiacStatus: CardiacStatusItems;
  eliminationStatus: EliminationStatusItems;
  neuroEmotionalStatus: NeuroEmotionalStatusItems;
  functionalAbilities: FunctionalAbilitiesItems; // GG items
  medicationManagement: MedicationManagementItems;
  careManagement: CareManagementItems;
  therapyNeed: TherapyNeedItems;

  // Scoring and calculations
  scoring: OasisScoring;

  // Voice auto-population tracking
  voicePopulation?: VoiceAutoPopulation;

  // Metadata
  completionPercentage: number;
  validationErrors: ValidationError[];
  clinicianId: string;
  supervisorId?: string;
  approvedBy?: string;
  approvedAt?: string;
  submittedAt?: string;
  lockedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentDates {
  m0030_startOfCareDate?: string;
  m0032_resumptionOfCareDate?: string;
  m0090_assessmentCompletionDate: string;
  m0100_assessmentReason: string;
  m0104_referralDate?: string;
  m0110_episodeTimingCode?: EpisodeTimingCode;
}

export type EpisodeTimingCode = '01' | '02' | '03' | '04' | '05' | 'UK';

// ===========================================
// OASIS SECTION TYPES (M ITEMS)
// ===========================================

// Clinical Record Items (M0010-M0080)
export interface ClinicalRecordItems {
  m0010_cmsNumber?: string;
  m0014_branchState?: string;
  m0016_branchId?: string;
  m0018_nationalProviderId?: string;
  m0020_patientId: string;
  m0030_startOfCareDate?: string;
  m0040_patientLastName: string;
  m0050_patientState: string;
  m0060_patientZip: string;
  m0063_medicareMedicaidNumber?: string;
  m0064_ssn?: string;
  m0065_medicareNumber?: string;
  m0066_birthDate: string;
  m0069_gender: GenderCode;
  m0080_disciplineOfPerson: DisciplineCode;
}

export type GenderCode = '1' | '2'; // 1=Male, 2=Female
export type DisciplineCode = '1' | '2' | '3' | '4' | '5' | '6';

// Patient Tracking Items (M0080-M0110)
export interface PatientTrackingItems {
  m0080_disciplineOfPerson: DisciplineCode;
  m0090_assessmentCompletionDate: string;
  m0100_assessmentReason: AssessmentReasonCode;
  m0102_assessmentReasonOther?: string;
  m0104_referralDate?: string;
  m0110_episodeTiming?: EpisodeTimingCode;
}

export type AssessmentReasonCode = '01' | '03' | '04' | '05' | '06' | '07' | '08' | '09';

// Patient History and Diagnoses (M1000-M1056)
export interface PatientHistoryItems {
  m1000_primaryDiagnosis: DiagnosisEntry;
  m1005_secondaryDiagnoses?: DiagnosisEntry[];
  m1010_casePaymentDiagnosis?: DiagnosisEntry;
  m1018_priorConditions?: PriorConditionCode[];
  m1021_primaryDiagnosisSeverity?: SeverityCode;
  m1023_secondaryDiagnosisSeverity?: SeverityCode[];
  m1028_activeTherapies?: TherapyCode[];
  m1030_therapiesReceivedAtHome?: TherapyCode[];
  m1033_riskForHospitalization?: RiskLevel;
  m1034_overallStatus?: OverallStatusCode;
  m1036_riskFactors?: RiskFactorCode[];
  m1041_influenzaVaccineReceived?: VaccineStatusCode;
  m1046_pneumoniaVaccineReceived?: VaccineStatusCode;
  m1051_covid19VaccineReceived?: VaccineStatusCode;
  m1056_fallRiskAssessment?: FallRiskCode;
}

export interface DiagnosisEntry {
  icd10Code: string;
  description: string;
  isPrimary: boolean;
  onsetDate?: string;
  severity?: SeverityCode;
  symptomControlRating?: number; // 0-4
}

export type SeverityCode = '0' | '1' | '2' | '3' | '4';
export type PriorConditionCode = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';
export type TherapyCode = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';
export type RiskLevel = '0' | '1' | '2' | '3';
export type OverallStatusCode = '0' | '1' | '2' | '3';
export type RiskFactorCode = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type VaccineStatusCode = '0' | '1' | '2' | '3' | '4';
export type FallRiskCode = '0' | '1' | '2';

// Living Situation (M1100-M1200)
export interface LivingSituationItems {
  m1100_patientLivingSituation: LivingSituationCode;
  m1106_transportationService?: TransportCode;
  m2102_adlStatusCount?: number;
  m2110_howOftenReceivesADLHelp?: ADLHelpFrequencyCode;
  m2115_typeOfADLHelp?: ADLHelpTypeCode[];
  m2200_priorResidence?: PriorResidenceCode;
}

export type LivingSituationCode = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12';
export type TransportCode = '0' | '1' | '2';
export type ADLHelpFrequencyCode = '0' | '1' | '2' | '3' | '4';
export type ADLHelpTypeCode = '1' | '2' | '3' | '4';
export type PriorResidenceCode = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | 'NA';

// Sensory Status (M1200-M1242)
export interface SensoryStatusItems {
  m1200_visionStatus: VisionStatusCode;
  m1210_hearingStatus?: HearingStatusCode;
  m1220_understandingVerbalContent?: UnderstandingCode;
  m1230_speechClarity?: SpeechClarityCode;
  m1240_painAssessment: PainFrequencyCode;
  m1242_painFrequency?: PainFrequencyCode;
}

export type VisionStatusCode = '0' | '1' | '2';
export type HearingStatusCode = '0' | '1' | '2' | '3' | '4';
export type UnderstandingCode = '0' | '1' | '2' | '3';
export type SpeechClarityCode = '0' | '1' | '2' | '3' | '4';
export type PainFrequencyCode = '0' | '1' | '2' | '3' | '4';

// Pain Assessment (M1240-M1246)
export interface PainAssessmentItems {
  m1240_hasPain: boolean;
  m1242_painFrequency?: PainFrequencyCode;
  m1244_painIntensity?: number; // 0-10
  m1246_painInterferesWithActivity?: PainInterferenceCode;
}

export type PainInterferenceCode = '0' | '1' | '2' | '3' | '4';

// Integumentary Status - Wounds (M1300-M1350)
export interface IntegumentaryStatusItems {
  m1300_skinIntegrity: SkinIntegrityCode;
  m1302_riskAssessmentCompleted?: boolean;
  m1306_unhealedPressureUlcers?: boolean;
  m1307_oldestPressureUlcerStage?: PressureUlcerStageCode;
  m1308_currentPressureUlcerCount?: PressureUlcerCounts;
  m1310_woundPresent?: boolean;
  m1311_woundTypes?: WoundTypeCode[];
  m1320_statusProblemPressureUlcer?: WoundStatusCode;
  m1322_currentStasisUlcerCount?: StasisUlcerCountCode;
  m1324_statusMostProblemStasisUlcer?: WoundStatusCode;
  m1330_surgicalWoundPresent?: SurgicalWoundCode;
  m1332_surgicalWoundCount?: number;
  m1334_statusMostProblemSurgicalWound?: WoundStatusCode;
  m1340_healingStatus?: HealingStatusCode;
  m1342_skinLesionsTreatment?: SkinTreatmentCode[];
}

export type SkinIntegrityCode = '0' | '1' | '2' | '3';
export type PressureUlcerStageCode = '1' | '2' | '3' | '4' | 'NA';
export type WoundTypeCode = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8';
export type WoundStatusCode = '0' | '1' | '2' | '3' | 'NA';
export type StasisUlcerCountCode = '0' | '1' | '2' | '3' | '4';
export type SurgicalWoundCode = '0' | '1' | '2';
export type HealingStatusCode = '0' | '1' | '2' | '3';
export type SkinTreatmentCode = '1' | '2' | '3' | '4' | '5' | '6';

export interface PressureUlcerCounts {
  stage2: number;
  stage3: number;
  stage4: number;
  unstageable: number;
  deepTissueInjury: number;
}

// Respiratory Status (M1400-M1410)
export interface RespiratoryStatusItems {
  m1400_dyspneaSeverity: DyspneaSeverityCode;
  m1410_respiratoryTreatments?: RespiratoryTreatmentCode[];
}

export type DyspneaSeverityCode = '0' | '1' | '2' | '3' | '4';
export type RespiratoryTreatmentCode = '1' | '2' | '3' | '4' | '5' | '6';

// Cardiac Status (M1500-M1510)
export interface CardiacStatusItems {
  m1500_symptomaticHeartFailure?: boolean;
  m1510_heartFailureFollowUp?: HeartFailureFollowUpCode;
}

export type HeartFailureFollowUpCode = '0' | '1' | '2' | '3' | '4' | '5' | 'NA';

// Elimination Status (M1600-M1630)
export interface EliminationStatusItems {
  m1600_urinaryTractInfection?: boolean;
  m1610_urinaryIncontinence?: UrinaryIncontinenceCode;
  m1615_bladderContinenceDevice?: boolean;
  m1620_bowelIncontinence?: BowelIncontinenceCode;
  m1630_ostomy?: boolean;
}

export type UrinaryIncontinenceCode = '0' | '1' | '2';
export type BowelIncontinenceCode = '0' | '1' | '2' | '3' | '4' | '5' | 'NA';

// Neuro/Emotional/Behavioral Status (M1700-M1750)
export interface NeuroEmotionalStatusItems {
  m1700_cognitiveFunction: CognitiveFunctionCode;
  m1710_whenConfused?: ConfusionFrequencyCode;
  m1720_whenAnxious?: AnxietyFrequencyCode;
  m1730_phq2DepressiveSymptoms?: PHQ2Score;
  m1740_phq9TotalScore?: number; // 0-27
  m1745_behavioralSymptoms?: BehavioralSymptomCode[];
  m1750_frequencyOfBehaviors?: BehaviorFrequencyCode;
}

export type CognitiveFunctionCode = '0' | '1' | '2' | '3' | '4';
export type ConfusionFrequencyCode = '0' | '1' | '2' | '3' | '4' | 'NA';
export type AnxietyFrequencyCode = '0' | '1' | '2' | '3' | 'NA';
export type BehavioralSymptomCode = '1' | '2' | '3' | '4' | '5' | '6' | '7';
export type BehaviorFrequencyCode = '0' | '1' | '2' | '3' | '4' | '5' | 'NA';

export interface PHQ2Score {
  littleInterest: number; // 0-3
  feelingDown: number; // 0-3
  totalScore: number; // 0-6
  requiresPHQ9: boolean;
}

// Functional Abilities - GG Items (GG0100-GG0170)
export interface FunctionalAbilitiesItems {
  // Self-Care
  gg0130_selfCare: SelfCareItems;
  // Mobility
  gg0170_mobility: MobilityItems;
  // Prior Functioning
  gg0100_priorFunctioning?: PriorFunctioningItems;
  // Discharge Goals
  gg0130_selfCareDischargeGoals?: SelfCareItems;
  gg0170_mobilityDischargeGoals?: MobilityItems;
}

export interface SelfCareItems {
  gg0130A_eating?: FunctionalScoreCode;
  gg0130B_oralHygiene?: FunctionalScoreCode;
  gg0130C_toiletingHygiene?: FunctionalScoreCode;
  gg0130E_showerBathe?: FunctionalScoreCode;
  gg0130F_upperBodyDressing?: FunctionalScoreCode;
  gg0130G_lowerBodyDressing?: FunctionalScoreCode;
  gg0130H_puttingOnFootwear?: FunctionalScoreCode;
}

export interface MobilityItems {
  gg0170A_rollLeftRight?: FunctionalScoreCode;
  gg0170B_sitToLying?: FunctionalScoreCode;
  gg0170C_lyingToSitting?: FunctionalScoreCode;
  gg0170D_sitToStand?: FunctionalScoreCode;
  gg0170E_chairBedToChair?: FunctionalScoreCode;
  gg0170F_toiletTransfer?: FunctionalScoreCode;
  gg0170G_carTransfer?: FunctionalScoreCode;
  gg0170I_walk10Feet?: FunctionalScoreCode;
  gg0170J_walk50FeetTwoTurns?: FunctionalScoreCode;
  gg0170K_walk150Feet?: FunctionalScoreCode;
  gg0170L_walk10FeetUnevenSurface?: FunctionalScoreCode;
  gg0170M_stepCurb?: FunctionalScoreCode;
  gg0170N_fourSteps?: FunctionalScoreCode;
  gg0170O_twelveSteps?: FunctionalScoreCode;
  gg0170P_pickingUpObject?: FunctionalScoreCode;
  gg0170R_wheelChair?: FunctionalScoreCode;
  gg0170S_wheelChair50Feet?: FunctionalScoreCode;
}

export interface PriorFunctioningItems {
  gg0100A_priorSelfCare?: PriorFunctioningCode;
  gg0100B_priorIndoorMobility?: PriorFunctioningCode;
  gg0100C_priorStairs?: PriorFunctioningCode;
  gg0100D_priorCognitive?: PriorFunctioningCode;
}

// Functional Score Codes (for GG items)
export type FunctionalScoreCode =
  | '06' // Independent
  | '05' // Setup or clean-up assistance
  | '04' // Supervision or touching assistance
  | '03' // Partial/moderate assistance
  | '02' // Substantial/maximal assistance
  | '01' // Dependent
  | '07' // Patient refused
  | '09' // Not applicable
  | '10' // Not attempted due to environmental limitations
  | '88'; // Not attempted due to medical condition

export type PriorFunctioningCode = '3' | '2' | '1' | '8' | '9' | 'NA';

// Medication Management (M2000-M2040)
export interface MedicationManagementItems {
  m2001_drugRegimenReviewConducted?: boolean;
  m2003_medicationFollowUp?: MedicationFollowUpCode;
  m2005_medicationIntervention?: MedicationInterventionCode;
  m2010_highRiskDrugEducation?: HighRiskDrugEducationCode;
  m2015_drugEducationIntervention?: DrugEducationInterventionCode[];
  m2020_medicationManagement?: MedicationManagementCode;
  m2030_injectableMedicationManagement?: MedicationManagementCode;
  m2040_priorMedicationManagement?: PriorMedicationManagementCode;
}

export type MedicationFollowUpCode = '0' | '1' | '2' | '3' | '4' | '5' | 'NA';
export type MedicationInterventionCode = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '9';
export type HighRiskDrugEducationCode = '0' | '1' | 'NA';
export type DrugEducationInterventionCode = '0' | '1' | '2' | '3' | '4' | '5';
export type MedicationManagementCode = '0' | '1' | '2' | '3' | 'NA';
export type PriorMedicationManagementCode = '0' | '1' | '2' | '3' | '4' | 'NA';

// Care Management (M2100-M2250)
export interface CareManagementItems {
  m2102_careManagementTypes?: CareManagementTypeCode[];
  m2200_therapyNeedReeval?: boolean;
  m2250_planOfCareOverview?: PlanOfCareItemCode[];
  emergencyPlanInPlace?: boolean;
  careCoordinationActivities?: CareCoordinationCode[];
}

export type CareManagementTypeCode = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10';
export type PlanOfCareItemCode = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11' | '12';
export type CareCoordinationCode = '1' | '2' | '3' | '4' | '5' | '6';

// Therapy Need (M2200)
export interface TherapyNeedItems {
  m2200_therapyNeedCount?: number;
  m2200_therapyNeedReeval?: TherapyNeedReevalCode;
  skillRequirementsMet?: boolean;
  therapyNeedJustification?: string;
}

export type TherapyNeedReevalCode = '0' | '1' | 'NA';

// ===========================================
// SCORING AND CALCULATIONS
// ===========================================

export interface OasisScoring {
  hippsCode?: string;
  clinicalGrouping?: ClinicalGroupingCode;
  functionalLevel?: FunctionalLevelCode;
  comorbidityAdjustment?: ComorbidityAdjustmentCode;
  caseMixWeight?: number;

  // Component scores
  functionalScore?: number;
  clinicalScore?: number;
  serviceUtilizationScore?: number;

  // Quality measures
  qualityMeasures?: QualityMeasure[];

  calculatedAt?: string;
  calculationVersion?: string;
}

export type ClinicalGroupingCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J';
export type FunctionalLevelCode = 'L' | 'M' | 'H';
export type ComorbidityAdjustmentCode = 'N' | 'L' | 'H';

export interface QualityMeasure {
  measureId: string;
  measureName: string;
  numerator: boolean;
  denominator: boolean;
  exclusion: boolean;
  value?: number;
}

// Scoring Rules
export interface ScoringRule {
  ruleId: string;
  itemCode: string;
  description: string;
  scoringLogic: string;
  responseWeights: Record<string, number>;
  skipPatterns?: SkipPattern[];
  validationRules: ValidationRule[];
}

export interface SkipPattern {
  triggerItem: string;
  triggerValues: string[];
  skipToItem: string;
  reason: string;
}

export interface ValidationRule {
  ruleId: string;
  ruleType: 'required' | 'conditional' | 'range' | 'consistency' | 'date';
  errorMessage: string;
  severity: 'error' | 'warning';
  condition?: string;
}

// ===========================================
// VOICE AUTO-POPULATION
// ===========================================

export interface VoiceAutoPopulation {
  transcriptionId: string;
  populatedAt: string;
  populatedFields: PopulatedField[];
  pendingReview: PendingReviewField[];
  rejectedFields: RejectedField[];
  statistics: PopulationStatistics;
}

export interface PopulatedField {
  itemCode: string;
  itemName: string;
  section: string;
  extractedValue: string | number;
  mappedValue: string | number;
  confidence: number;
  sourceText: string;
  sourceTimestamp?: number; // Timestamp in audio
  acceptedBy?: string;
  acceptedAt?: string;
  autoAccepted: boolean;
}

export interface PendingReviewField {
  itemCode: string;
  itemName: string;
  section: string;
  extractedValue: string | number;
  suggestedValue: string | number;
  alternativeValues?: { value: string | number; confidence: number }[];
  confidence: number;
  sourceText: string;
  reviewReason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface RejectedField {
  itemCode: string;
  itemName: string;
  extractedValue: string | number;
  rejectedBy: string;
  rejectedAt: string;
  rejectionReason: string;
  manualValue?: string | number;
}

export interface PopulationStatistics {
  totalFieldsPopulated: number;
  autoAcceptedCount: number;
  pendingReviewCount: number;
  rejectedCount: number;
  averageConfidence: number;
  timesSaved: number; // Estimated time saved in minutes
}

// ===========================================
// OASIS QUESTION LIBRARY
// ===========================================

export interface OasisQuestion {
  itemCode: string;
  itemName: string;
  section: OasisSectionCode;
  questionText: string;
  helpText?: string;
  responseType: ResponseType;
  responses?: OasisResponse[];
  skipLogic?: SkipLogic;
  validationRules: ValidationRule[];
  scoringRules?: ScoringRule[];
  assessmentTypes: OasisAssessmentType[];
  effectiveDate: string;
  retiredDate?: string;
  cmsGuidance?: string;
}

export type OasisSectionCode =
  | 'clinical_record'
  | 'patient_tracking'
  | 'patient_history'
  | 'living_situation'
  | 'sensory_status'
  | 'pain_assessment'
  | 'integumentary'
  | 'respiratory'
  | 'cardiac'
  | 'elimination'
  | 'neuro_emotional'
  | 'functional_abilities'
  | 'medication_management'
  | 'care_management'
  | 'therapy_need';

export type ResponseType = 'single_select' | 'multi_select' | 'numeric' | 'date' | 'text' | 'icd10';

export interface OasisResponse {
  code: string;
  label: string;
  description?: string;
  scoringWeight?: number;
  triggersSkip?: boolean;
  skipToItem?: string;
}

export interface SkipLogic {
  condition: string;
  skipToItem: string;
  reason: string;
}

// Validation
export interface ValidationError {
  itemCode: string;
  itemName: string;
  errorType: 'required' | 'invalid' | 'consistency' | 'range' | 'skip_violation';
  message: string;
  severity: 'error' | 'warning';
  suggestedFix?: string;
}

// ===========================================
// REQUEST/RESPONSE TYPES
// ===========================================

export interface CreateAssessmentRequest {
  patientId: string;
  episodeId: string;
  assessmentType: OasisAssessmentType;
  assessmentReason?: string;
  startOfCareDate?: string;
  clinicianId?: string;
  copyFromAssessmentId?: string; // Copy from previous assessment
}

export interface UpdateAssessmentRequest {
  section?: string;
  items?: Record<string, unknown>;
  status?: AssessmentStatus;
  assessmentCompletionDate?: string;
}

export interface SubmitAssessmentRequest {
  supervisorId?: string;
  notes?: string;
  attestation: boolean; // Clinician attestation that info is accurate
}

export interface AssessmentListQuery {
  page?: string;
  limit?: string;
  patientId?: string;
  episodeId?: string;
  assessmentType?: OasisAssessmentType;
  status?: AssessmentStatus;
  clinicianId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: 'createdAt' | 'assessmentDate' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface QuestionLibraryQuery {
  section?: OasisSectionCode;
  assessmentType?: OasisAssessmentType;
  search?: string;
  includeRetired?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ===========================================
// ROUTER INITIALIZATION
// ===========================================

const router = Router();

// ===========================================
// ROUTES
// ===========================================

/**
 * @route   GET /api/oasis/questions
 * @desc    Get OASIS question library
 * @access  Private - All authenticated users
 */
router.get(
  '/questions',
  authenticate,
  oasisController.getQuestionLibrary
);

/**
 * @route   GET /api/oasis/assessments
 * @desc    List all OASIS assessments with filtering
 * @access  Private - Clinical staff only
 */
router.get(
  '/assessments',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.MEDICAL_SOCIAL_WORKER,
    UserRole.BILLING,
    UserRole.READONLY,
  ]),
  oasisController.listAssessments
);

/**
 * @route   POST /api/oasis/assessments
 * @desc    Create new OASIS assessment
 * @access  Private - Licensed clinicians only (nurses and therapists can complete OASIS)
 */
router.post(
  '/assessments',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.MEDICAL_SOCIAL_WORKER,
  ]),
  oasisController.createAssessment
);

/**
 * @route   GET /api/oasis/assessments/:id
 * @desc    Get single OASIS assessment by ID
 * @access  Private - Clinical staff only
 */
router.get(
  '/assessments/:id',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.MEDICAL_SOCIAL_WORKER,
    UserRole.BILLING,
    UserRole.READONLY,
  ]),
  oasisController.getAssessment
);

/**
 * @route   PUT /api/oasis/assessments/:id
 * @desc    Update OASIS assessment
 * @access  Private - Assessment owner or admin/supervisor
 */
router.put(
  '/assessments/:id',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.MEDICAL_SOCIAL_WORKER,
  ]),
  oasisController.updateAssessment
);

/**
 * @route   DELETE /api/oasis/assessments/:id
 * @desc    Soft delete OASIS assessment
 * @access  Private - Admin/Supervisor only
 */
router.delete(
  '/assessments/:id',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
  ]),
  oasisController.deleteAssessment
);

/**
 * @route   POST /api/oasis/assessments/:id/submit
 * @desc    Submit OASIS assessment for review
 * @access  Private - Assessment owner only
 */
router.post(
  '/assessments/:id/submit',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.MEDICAL_SOCIAL_WORKER,
  ]),
  oasisController.submitForReview
);

/**
 * @route   POST /api/oasis/assessments/:id/review
 * @desc    Review (approve/reject) OASIS assessment
 * @access  Private - Supervisors and admins only
 */
router.post(
  '/assessments/:id/review',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
  ]),
  oasisController.reviewAssessment
);

/**
 * @route   POST /api/oasis/assessments/:id/lock
 * @desc    Lock OASIS assessment (final submission to CMS)
 * @access  Private - Supervisors and admins only
 */
router.post(
  '/assessments/:id/lock',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
  ]),
  oasisController.lockAssessment
);

/**
 * @route   POST /api/oasis/assessments/:id/calculate-score
 * @desc    Calculate HIPPS code and scoring for assessment
 * @access  Private - Clinical staff only
 */
router.post(
  '/assessments/:id/calculate-score',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.MEDICAL_SOCIAL_WORKER,
    UserRole.BILLING,
  ]),
  oasisController.calculateScore
);

/**
 * @route   GET /api/oasis/assessments/:id/hipps
 * @desc    Get detailed HIPPS code information with breakdown and reimbursement estimate
 * @access  Private - Clinical staff only
 * @query   includeOptimizations - If 'true', include optimization suggestions (supervisors only)
 * @query   wageIndex - Optional wage index for reimbursement calculation (default: 1.0)
 * @query   recalculate - If 'true', recalculate HIPPS code instead of using cached value
 */
router.get(
  '/assessments/:id/hipps',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.MEDICAL_SOCIAL_WORKER,
    UserRole.BILLING,
    UserRole.READONLY,
  ]),
  oasisController.getHippsDetails
);

/**
 * @route   POST /api/oasis/assessments/:id/calculate-hipps
 * @desc    Calculate enhanced HIPPS code with full breakdown and optimization suggestions
 * @access  Private - Clinical staff only
 * @body    includeOptimizations - If true, include optimization suggestions (supervisors only)
 * @body    wageIndex - Optional wage index for reimbursement calculation
 */
router.post(
  '/assessments/:id/calculate-hipps',
  authenticate,
  authorize([
    UserRole.ADMIN,
    UserRole.SUPERVISOR,
    UserRole.NURSE,
    UserRole.THERAPIST_PT,
    UserRole.THERAPIST_OT,
    UserRole.THERAPIST_ST,
    UserRole.MEDICAL_SOCIAL_WORKER,
    UserRole.BILLING,
  ]),
  oasisController.calculateEnhancedScore
);

export default router;
