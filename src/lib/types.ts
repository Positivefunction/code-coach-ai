export interface Problem {
  id: string;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
  starter_code: string;
  test_cases: TestCase[];
  constraints: string;
  examples: Example[];
  created_at: string;
}

export interface TestCase {
  input: string;
  expected_output: string;
  is_hidden: boolean;
}

export interface Example {
  input: string;
  output: string;
  explanation?: string;
}

export interface Submission {
  id: string;
  user_id: string;
  problem_id: string;
  code: string;
  language: string;
  passed_tests: number;
  total_tests: number;
  runtime_ms: number;
  memory_usage: string;
  quality_score: number | null;
  efficiency: string | null;
  mistake_type: string | null;
  optimization_possible: boolean;
  feedback: SubmissionFeedback;
  static_analysis: StaticAnalysis;
  created_at: string;
}

export interface SubmissionFeedback {
  explanation?: string;
  improved_pseudocode?: string;
  followup_question?: string;
}

export interface StaticAnalysis {
  cyclomatic_complexity?: number;
  nested_loop_depth?: number;
  recursion_detected?: boolean;
  line_count?: number;
  function_count?: number;
}

export interface EvaluationResult {
  passed_tests: number;
  total_tests: number;
  runtime_ms: number;
  memory_usage: string;
  quality_score: number;
  efficiency: string;
  mistake_type: string | null;
  optimization_possible: boolean;
  static_analysis: StaticAnalysis;
  feedback: SubmissionFeedback;
}

export interface SkillProfile {
  level: string;
  strengths: string[];
  weaknesses: string[];
  points: number;
}
