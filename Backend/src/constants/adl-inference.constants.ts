/**
 * ADL Inference Constants
 *
 * Defines mappings for inferring multiple OASIS responses from
 * aggregate clinician statements like "moderate assistance with all ADLs"
 *
 * Used by the OASIS extraction service to expand voice input into
 * multiple related OASIS items.
 */

// ===========================================
// ASSISTANCE LEVEL MAPPINGS
// ===========================================

/**
 * Maps natural language assistance descriptions to GG item response codes
 * GG items use 06 (Independent) to 01 (Dependent) scale
 */
export const ASSISTANCE_LEVEL_CODES: Record<string, {
  code: string;
  label: string;
  keywords: string[];
  confidence: number;
}> = {
  independent: {
    code: '06',
    label: 'Independent',
    keywords: [
      'independent', 'independently', 'no help', 'no assistance',
      'by themselves', 'by himself', 'by herself', 'on their own',
      'without help', 'without assistance', 'does it alone'
    ],
    confidence: 0.95,
  },
  setup_assistance: {
    code: '05',
    label: 'Setup or clean-up assistance',
    keywords: [
      'setup', 'set up', 'set-up', 'clean up', 'cleanup', 'clean-up',
      'preparation', 'prepares items', 'lays out clothes',
      'minimal setup', 'just needs setup'
    ],
    confidence: 0.90,
  },
  supervision: {
    code: '04',
    label: 'Supervision or touching assistance',
    keywords: [
      'supervision', 'supervise', 'standby', 'stand by', 'stand-by',
      'cueing', 'cues', 'verbal cues', 'prompting', 'prompts',
      'touching assistance', 'contact guard', 'minimal contact',
      'light touch', 'steadying'
    ],
    confidence: 0.90,
  },
  partial_assistance: {
    code: '03',
    label: 'Partial/moderate assistance',
    keywords: [
      'partial assistance', 'partial', 'moderate assistance', 'moderate',
      'some help', 'some assistance', 'minimal assistance', 'min assist',
      'mod assist', 'mod a', 'less than half', 'guided movement',
      'helping with', 'assists with'
    ],
    confidence: 0.85,
  },
  substantial_assistance: {
    code: '02',
    label: 'Substantial/maximal assistance',
    keywords: [
      'substantial assistance', 'substantial', 'maximal assistance', 'maximal',
      'max assist', 'max a', 'significant help', 'significant assistance',
      'more than half', 'majority of effort', 'weight bearing'
    ],
    confidence: 0.85,
  },
  dependent: {
    code: '01',
    label: 'Dependent',
    keywords: [
      'dependent', 'total assistance', 'total assist', 'total a',
      'complete assistance', 'completely dependent', 'fully dependent',
      'cannot do', 'unable to', 'patient did not', 'two person assist',
      '2 person assist', 'maximum assistance throughout'
    ],
    confidence: 0.90,
  },
  activity_not_attempted_safety: {
    code: '07',
    label: 'Patient refused',
    keywords: [
      'refused', 'refuses', 'declined', 'declines', 'would not',
      'patient refused', 'declined to participate'
    ],
    confidence: 0.90,
  },
  activity_not_attempted_condition: {
    code: '09',
    label: 'Not applicable',
    keywords: [
      'not applicable', 'n/a', 'not assessed', 'unable to assess',
      'not attempted due to medical condition', 'contraindicated'
    ],
    confidence: 0.85,
  },
  not_attempted_environmental: {
    code: '10',
    label: 'Not attempted due to environmental limitations',
    keywords: [
      'environmental limitation', 'environment prevents', 'no stairs',
      'no shower', 'not attempted due to environment'
    ],
    confidence: 0.85,
  },
  not_attempted_not_usual: {
    code: '88',
    label: 'Not attempted - not part of usual routine',
    keywords: [
      'not part of usual', 'does not usually', 'not in routine',
      'never does this', 'not applicable to lifestyle'
    ],
    confidence: 0.85,
  },
};

// ===========================================
// ADL CATEGORY DEFINITIONS
// ===========================================

/**
 * Defines ADL categories with their associated OASIS item codes
 * When a clinician says "all ADLs", these are the items to populate
 */
export interface ADLCategory {
  name: string;
  description: string;
  keywords: string[];
  itemCodes: string[];
}

export const ADL_CATEGORIES: Record<string, ADLCategory> = {
  // Self-Care ADLs (GG0130 series)
  self_care_all: {
    name: 'All Self-Care',
    description: 'All self-care ADLs including eating, hygiene, dressing, and bathing',
    keywords: [
      'all adls', 'all self-care', 'all self care', 'all activities of daily living',
      'adls', 'self-care activities', 'personal care', 'basic adls'
    ],
    itemCodes: [
      'GG0130A', 'GG0130B', 'GG0130C', 'GG0130D', 'GG0130E',
      'GG0130F', 'GG0130G', 'GG0130H'
    ],
  },
  eating: {
    name: 'Eating',
    description: 'Ability to eat and use utensils',
    keywords: ['eating', 'feeding', 'feeds', 'meals', 'utensils'],
    itemCodes: ['GG0130A'],
  },
  hygiene: {
    name: 'Hygiene',
    description: 'Oral hygiene, toileting hygiene, and upper body washing',
    keywords: [
      'hygiene', 'personal hygiene', 'grooming', 'oral care', 'teeth',
      'toileting hygiene', 'perineal care', 'washing'
    ],
    itemCodes: ['GG0130B', 'GG0130C', 'GG0130D'],
  },
  bathing: {
    name: 'Bathing',
    description: 'Showering and bathing self',
    keywords: [
      'bathing', 'shower', 'showering', 'bath', 'washing body',
      'bathe self', 'bathing self'
    ],
    itemCodes: ['GG0130E', 'GG0130D'],
  },
  dressing: {
    name: 'Dressing',
    description: 'Upper and lower body dressing including footwear',
    keywords: [
      'dressing', 'getting dressed', 'clothing', 'clothes', 'dress self',
      'putting on clothes', 'undressing', 'upper body dressing',
      'lower body dressing', 'footwear', 'shoes', 'socks'
    ],
    itemCodes: ['GG0130F', 'GG0130G', 'GG0130H'],
  },

  // Mobility ADLs (GG0170 series)
  mobility_all: {
    name: 'All Mobility',
    description: 'All mobility activities including transfers and ambulation',
    keywords: [
      'all mobility', 'all transfers', 'all ambulation', 'getting around',
      'moving around', 'mobility activities'
    ],
    itemCodes: [
      'GG0170A', 'GG0170B', 'GG0170C', 'GG0170D', 'GG0170E',
      'GG0170F', 'GG0170I', 'GG0170J', 'GG0170K', 'GG0170M',
      'GG0170N', 'GG0170O', 'GG0170P'
    ],
  },
  bed_mobility: {
    name: 'Bed Mobility',
    description: 'Rolling, sitting up, lying down in bed',
    keywords: [
      'bed mobility', 'in bed', 'rolling', 'roll over', 'turning in bed',
      'supine to sit', 'sit to supine', 'lying to sitting', 'sitting to lying'
    ],
    itemCodes: ['GG0170A', 'GG0170B', 'GG0170C'],
  },
  transfers: {
    name: 'Transfers',
    description: 'All transfer activities',
    keywords: [
      'transfers', 'transferring', 'sit to stand', 'stand pivot',
      'bed to chair', 'chair to bed', 'toilet transfer', 'car transfer',
      'getting up', 'getting out of bed', 'getting out of chair'
    ],
    itemCodes: ['GG0170D', 'GG0170E', 'GG0170F', 'GG0170G'],
  },
  ambulation: {
    name: 'Ambulation',
    description: 'Walking activities at various distances',
    keywords: [
      'ambulation', 'walking', 'walks', 'gait', 'ambulates', 'walking distance',
      'household ambulation', 'community ambulation'
    ],
    itemCodes: ['GG0170I', 'GG0170J', 'GG0170K', 'GG0170H'],
  },
  stairs: {
    name: 'Stairs',
    description: 'Stair climbing activities',
    keywords: [
      'stairs', 'steps', 'climbing stairs', 'stair climbing', 'curb', 'curbs',
      'going up stairs', 'going down stairs'
    ],
    itemCodes: ['GG0170M', 'GG0170N', 'GG0170O'],
  },
  functional_reach: {
    name: 'Functional Reach',
    description: 'Bending and reaching activities',
    keywords: [
      'picking up', 'bending', 'reaching', 'stooping', 'pick up object',
      'reach down', 'floor level'
    ],
    itemCodes: ['GG0170P'],
  },

  // Combined categories
  all_functional: {
    name: 'All Functional Activities',
    description: 'All self-care and mobility activities combined',
    keywords: [
      'all functional', 'all functional abilities', 'functional activities',
      'all gg items', 'complete functional assessment'
    ],
    itemCodes: [
      'GG0130A', 'GG0130B', 'GG0130C', 'GG0130D', 'GG0130E',
      'GG0130F', 'GG0130G', 'GG0130H',
      'GG0170A', 'GG0170B', 'GG0170C', 'GG0170D', 'GG0170E',
      'GG0170F', 'GG0170I', 'GG0170J', 'GG0170K', 'GG0170M',
      'GG0170N', 'GG0170O', 'GG0170P'
    ],
  },
};

// ===========================================
// INFERENCE PATTERNS
// ===========================================

/**
 * Common patterns for aggregate statements that should trigger inference
 */
export interface InferencePattern {
  pattern: RegExp;
  categoryKey: string;
  extractAssistanceLevel: boolean;
  confidence: number;
}

export const INFERENCE_PATTERNS: InferencePattern[] = [
  // "patient requires [level] assistance with all ADLs"
  {
    pattern: /(?:patient|pt|she|he)\s+(?:requires?|needs?)\s+(\w+(?:\s+\w+)?)\s+(?:assistance|assist|help)\s+(?:with\s+)?(?:all\s+)?(?:adls?|activities\s+of\s+daily\s+living|self[- ]?care)/i,
    categoryKey: 'self_care_all',
    extractAssistanceLevel: true,
    confidence: 0.85,
  },
  // "moderate assistance with bathing, dressing, and hygiene"
  {
    pattern: /(\w+(?:\s+\w+)?)\s+(?:assistance|assist|help)\s+(?:with\s+)?(?:bathing|dressing|hygiene|eating)/i,
    categoryKey: 'self_care_all',
    extractAssistanceLevel: true,
    confidence: 0.85,
  },
  // "all transfers require max assist"
  {
    pattern: /(?:all\s+)?transfers?\s+(?:require|need)\s+(\w+(?:\s+\w+)?)\s*(?:assist(?:ance)?)?/i,
    categoryKey: 'transfers',
    extractAssistanceLevel: true,
    confidence: 0.85,
  },
  // "independent with all mobility"
  {
    pattern: /(\w+)\s+(?:with\s+)?(?:all\s+)?mobility/i,
    categoryKey: 'mobility_all',
    extractAssistanceLevel: true,
    confidence: 0.85,
  },
  // "requires supervision for all functional activities"
  {
    pattern: /(?:requires?|needs?)\s+(\w+(?:\s+\w+)?)\s+(?:for\s+)?(?:all\s+)?functional\s+(?:activities|abilities)/i,
    categoryKey: 'all_functional',
    extractAssistanceLevel: true,
    confidence: 0.85,
  },
  // "bed mobility is independent"
  {
    pattern: /bed\s+mobility\s+(?:is\s+)?(\w+)/i,
    categoryKey: 'bed_mobility',
    extractAssistanceLevel: true,
    confidence: 0.90,
  },
  // "ambulation requires mod assist"
  {
    pattern: /(?:ambulation|walking|gait)\s+(?:requires?|needs?)\s+(\w+(?:\s+\w+)?)/i,
    categoryKey: 'ambulation',
    extractAssistanceLevel: true,
    confidence: 0.85,
  },
  // "stair climbing dependent"
  {
    pattern: /(?:stair|stairs|steps?)\s+(?:climbing\s+)?(?:is\s+)?(\w+)/i,
    categoryKey: 'stairs',
    extractAssistanceLevel: true,
    confidence: 0.85,
  },
  // "dressing upper and lower body requires partial assist"
  {
    pattern: /dressing\s+(?:upper\s+and\s+lower\s+body\s+)?(?:requires?|needs?)\s+(\w+(?:\s+\w+)?)/i,
    categoryKey: 'dressing',
    extractAssistanceLevel: true,
    confidence: 0.85,
  },
];

// ===========================================
// ITEM CODE TO CATEGORY REVERSE MAPPING
// ===========================================

/**
 * Maps individual item codes back to their parent categories
 * Used for grouping in the UI
 */
export const ITEM_TO_CATEGORY_MAP: Record<string, string> = {};

// Build reverse mapping
Object.entries(ADL_CATEGORIES).forEach(([categoryKey, category]) => {
  category.itemCodes.forEach((itemCode) => {
    // Use most specific category for each item
    if (!ITEM_TO_CATEGORY_MAP[itemCode]) {
      ITEM_TO_CATEGORY_MAP[itemCode] = categoryKey;
    }
  });
});

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Extract assistance level from text
 */
export function extractAssistanceLevel(text: string): {
  code: string;
  label: string;
  confidence: number;
} | null {
  const lowerText = text.toLowerCase();

  for (const [, level] of Object.entries(ASSISTANCE_LEVEL_CODES)) {
    for (const keyword of level.keywords) {
      if (lowerText.includes(keyword)) {
        return {
          code: level.code,
          label: level.label,
          confidence: level.confidence,
        };
      }
    }
  }

  return null;
}

/**
 * Find matching ADL categories for a text phrase
 */
export function findMatchingCategories(text: string): ADLCategory[] {
  const lowerText = text.toLowerCase();
  const matches: ADLCategory[] = [];

  for (const category of Object.values(ADL_CATEGORIES)) {
    for (const keyword of category.keywords) {
      if (lowerText.includes(keyword)) {
        matches.push(category);
        break;
      }
    }
  }

  return matches;
}

/**
 * Apply inference patterns to extract ADL category and assistance level
 */
export function applyInferencePatterns(text: string): Array<{
  category: ADLCategory;
  assistanceLevel: { code: string; label: string; confidence: number } | null;
  sourceText: string;
  patternConfidence: number;
}> {
  const results: Array<{
    category: ADLCategory;
    assistanceLevel: { code: string; label: string; confidence: number } | null;
    sourceText: string;
    patternConfidence: number;
  }> = [];

  for (const pattern of INFERENCE_PATTERNS) {
    const match = text.match(pattern.pattern);
    if (match) {
      const category = ADL_CATEGORIES[pattern.categoryKey];
      if (!category) continue;

      let assistanceLevel = null;
      if (pattern.extractAssistanceLevel && match[1]) {
        assistanceLevel = extractAssistanceLevel(match[1]);
      }

      results.push({
        category,
        assistanceLevel,
        sourceText: match[0],
        patternConfidence: pattern.confidence,
      });
    }
  }

  return results;
}

export default {
  ASSISTANCE_LEVEL_CODES,
  ADL_CATEGORIES,
  INFERENCE_PATTERNS,
  ITEM_TO_CATEGORY_MAP,
  extractAssistanceLevel,
  findMatchingCategories,
  applyInferencePatterns,
};
