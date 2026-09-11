// Raw Excel column header -> canonical target, built from a manual header-by-header
// survey of all 9 staged chronicle files (see the plan doc / conversation history).
// Every entry here is an explicit, human-reviewed literal match after normalization —
// never a fuzzy/semantic guess. An unrecognized header must be added here deliberately;
// scripts/import.ts refuses to import a file with an unmapped header rather than skip
// or guess at it.
//
// Normalization: trim, collapse all whitespace runs (including newlines) to one space,
// lowercase. This absorbs cosmetic drift between cycles (extra spaces, line breaks,
// capitalization) without merging headers that are genuinely different questions.

export function normalizeHeader(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().toLowerCase();
}

// Sentinels for the two headers that aren't stored in responses.data at all:
// TIMESTAMP -> responses.submitted_at, COMPANY -> resolved to responses.company_id.
export const TIMESTAMP = 'TIMESTAMP' as const;
export const COMPANY = 'COMPANY' as const;

export type MapTarget = typeof TIMESTAMP | typeof COMPANY | string | null;

export const HEADER_MAP: Record<string, MapTarget> = {
  timestamp: TIMESTAMP,
  'email address': 'email',
  name: 'name',
  status: null, // internal "Done" marker in Placements 2022-23, not response data
  'bits id': 'id_number',
  'bits id (2020xxpsxxxxg)': 'id_number',
  'id number': 'id_number',
  branch: 'branch',
  cgpa: 'cgpa',

  // company name
  'what company are you placed in?': COMPANY,
  'name of the company where you are placed': COMPANY,
  'name of the company': COMPANY,
  organization: COMPANY,

  // role / profile
  'what is your profile in the company?': 'role',
  'role offered': 'role',
  profile: 'role',

  // compensation / stipend
  compensation: 'compensation',
  ctc: 'compensation',
  stipend: 'compensation',
  'stipend offered': 'compensation',

  // SIP-2022-23-only context
  location: 'location',
  sector: 'sector',

  // recruitment process
  'what was the structure of your interview process?': 'recruitment_process',
  'what was the recruitment process? elaborate on numbers and types of rounds.':
    'recruitment_process',
  'recruitment procedure': 'recruitment_process',

  // topics
  'what are the important topics to prepare?': 'topics',
  'topics on which questions were asked/ important topics to remember (only the name of the topics eg. sql/python/any relevant course/dsa/guesstimates/puzzles/case/mental maths etc.)':
    'topics',
  'important topics and subtopics to remember': 'topics',

  // sources of preparation (two real wording variants exist, not just whitespace)
  'what sources do you recommend to prepare from?': 'sources',
  'sources of preparation(only the name of the resources gfg, striver, leetcode,case books, youtube channels, reference material etc.)':
    'sources',
  'sources of preparation(only the name of the resources gfg, striver, leetcode, case books, youtube channels, reference material etc.)':
    'sources',
  'sources of preparation': 'sources',

  // questions recalled
  'what were some questions that you were asked?': 'questions_recalled',
  'mention the question(s) asked in your interview or test which you can recall.':
    'questions_recalled',

  // unprepared-for questions
  "questions that you weren't prepared for": 'unprepared_questions',

  // courses / certifications
  'relevant courses and certification': 'courses_certifications',
  'courses and certifications': 'courses_certifications',

  // prior experience
  'your previous working experience/internship': 'prior_experience',

  // achievements
  'elaborate on the standout achievements or highlights(competitions, research projects/papers etc.) in your resume that you believe set you apart?':
    'achievements',

  // additional comments (several real wording variants)
  'any other relevant information regarding the interviews or the written tests?':
    'additional_comments',
  'additional comments': 'additional_comments',
  'additional comments/tips for the students': 'additional_comments',
  'any additional comments': 'additional_comments',

  // one-off fields (present in only one or two cycles)
  'any other relevant information for training?': 'training_comments',
  'when did you start your preparation': 'when_start_prep',
  'when did you start your preparation.': 'when_start_prep',

  // SIP-2022-23 form-meta questions — feedback to the coordinator, never shown to students
  'suggestions for improving this form': 'form_meta_suggestions',
  'if a student has not started preparation yet, how can they start preperation and complete preperation in a short time':
    'form_meta_how_to_start',
  'feedback for placement unit': 'form_meta_pu_feedback',

  // Google Sheets "Document Studio" add-on artifacts (Placements 2022-23 only) — never
  // response data.
  '[document studio] file status': null,
  '[document studio] file link': null,
};
