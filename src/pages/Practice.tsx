import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Editor from '@monaco-editor/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Loader2, CheckCircle2, XCircle, Brain, Lightbulb, ArrowLeft } from 'lucide-react';
import type { Problem, EvaluationResult } from '@/lib/types';

export default function Practice() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const problemId = params.get('problem');

  const [problem, setProblem] = useState<Problem | null>(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [activeTab, setActiveTab] = useState('description');

  useEffect(() => {
    if (!problemId) return;
    supabase.from('problems').select('*').eq('id', problemId).single().then(({ data }) => {
      if (data) {
        const p = data as unknown as Problem;
        setProblem(p);
        setCode(p.starter_code || '# Write your Python solution here\n\n');
      }
    });
  }, [problemId]);

  const handleSubmit = async () => {
    if (!user || !problem) return;
    setSubmitting(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('evaluate-code', {
        body: {
          code,
          problem_id: problem.id,
          problem_title: problem.title,
          problem_description: problem.description,
          test_cases: problem.test_cases,
          topic: problem.topic,
        },
      });

      if (error) throw error;
      const evalResult = data as EvaluationResult;
      setResult(evalResult);
      setActiveTab('results');

      // Save submission
      await supabase.from('submissions').insert([{
        user_id: user.id,
        problem_id: problem.id,
        code,
        language: 'python',
        passed_tests: evalResult.passed_tests,
        total_tests: evalResult.total_tests,
        runtime_ms: evalResult.runtime_ms,
        memory_usage: evalResult.memory_usage,
        quality_score: evalResult.quality_score,
        efficiency: evalResult.efficiency,
        mistake_type: evalResult.mistake_type,
        optimization_possible: evalResult.optimization_possible,
        feedback: evalResult.feedback as unknown as Record<string, unknown>,
        static_analysis: evalResult.static_analysis as unknown as Record<string, unknown>,
      }] as any);

      toast.success('Code evaluated!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Evaluation failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!problemId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Select a problem to start practicing</p>
        <Button onClick={() => navigate('/problems')}>Browse Problems</Button>
      </div>
    );
  }

  if (!problem) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading problem...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/problems')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">{problem.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="capitalize">{problem.difficulty}</Badge>
            <Badge variant="secondary">{problem.topic}</Badge>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 min-h-[600px]">
        {/* Left: Problem + Results */}
        <div className="space-y-4">
          <Card className="h-full">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader className="pb-2">
                <TabsList className="w-full">
                  <TabsTrigger value="description" className="flex-1">Description</TabsTrigger>
                  <TabsTrigger value="results" className="flex-1">Results</TabsTrigger>
                  <TabsTrigger value="feedback" className="flex-1">AI Feedback</TabsTrigger>
                </TabsList>
              </CardHeader>
              <CardContent>
                <TabsContent value="description" className="mt-0 space-y-4">
                  <div className="prose prose-sm prose-invert max-w-none">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{problem.description}</p>
                  </div>
                  {problem.examples && (problem.examples as unknown as Array<{input: string; output: string; explanation?: string}>).length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-foreground">Examples</h4>
                      {(problem.examples as unknown as Array<{input: string; output: string; explanation?: string}>).map((ex, i) => (
                        <div key={i} className="bg-secondary/50 rounded-lg p-3 space-y-1">
                          <p className="text-xs font-mono text-foreground"><span className="text-muted-foreground">Input:</span> {ex.input}</p>
                          <p className="text-xs font-mono text-foreground"><span className="text-muted-foreground">Output:</span> {ex.output}</p>
                          {ex.explanation && <p className="text-xs text-muted-foreground">{ex.explanation}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  {problem.constraints && (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-1">Constraints</h4>
                      <p className="text-xs text-muted-foreground">{problem.constraints}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="results" className="mt-0">
                  <AnimatePresence mode="wait">
                    {result ? (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50">
                          {result.passed_tests === result.total_tests
                            ? <CheckCircle2 className="w-8 h-8 text-success" />
                            : <XCircle className="w-8 h-8 text-destructive" />}
                          <div>
                            <p className="font-bold text-foreground text-lg">{result.passed_tests}/{result.total_tests} Tests Passed</p>
                            <p className="text-xs text-muted-foreground">Runtime: {result.runtime_ms}ms • Memory: {result.memory_usage}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 rounded-lg bg-secondary/50">
                            <p className="text-xs text-muted-foreground">Quality Score</p>
                            <p className="text-xl font-bold text-primary">{result.quality_score}/5</p>
                          </div>
                          <div className="p-3 rounded-lg bg-secondary/50">
                            <p className="text-xs text-muted-foreground">Efficiency</p>
                            <p className="text-xl font-bold text-foreground">{result.efficiency}</p>
                          </div>
                        </div>

                        {result.mistake_type && (
                          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                            <p className="text-xs text-warning font-medium">Detected Issue</p>
                            <p className="text-sm text-foreground">{result.mistake_type}</p>
                          </div>
                        )}

                        {result.static_analysis && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Static Analysis</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-2 rounded bg-secondary/50">
                                <span className="text-muted-foreground">Complexity:</span>{' '}
                                <span className="text-foreground font-mono">{result.static_analysis.cyclomatic_complexity}</span>
                              </div>
                              <div className="p-2 rounded bg-secondary/50">
                                <span className="text-muted-foreground">Loop Depth:</span>{' '}
                                <span className="text-foreground font-mono">{result.static_analysis.nested_loop_depth}</span>
                              </div>
                              <div className="p-2 rounded bg-secondary/50">
                                <span className="text-muted-foreground">Lines:</span>{' '}
                                <span className="text-foreground font-mono">{result.static_analysis.line_count}</span>
                              </div>
                              <div className="p-2 rounded bg-secondary/50">
                                <span className="text-muted-foreground">Functions:</span>{' '}
                                <span className="text-foreground font-mono">{result.static_analysis.function_count}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Brain className="w-10 h-10 mb-3 opacity-40" />
                        <p className="text-sm">Submit your code to see results</p>
                      </div>
                    )}
                  </AnimatePresence>
                </TabsContent>

                <TabsContent value="feedback" className="mt-0">
                  {result?.feedback?.explanation ? (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="w-4 h-4 text-primary" />
                          <p className="text-sm font-semibold text-foreground">AI Explanation</p>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{result.feedback.explanation}</p>
                      </div>
                      {result.feedback.improved_pseudocode && (
                        <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
                          <p className="text-sm font-semibold text-foreground mb-2">Suggested Approach</p>
                          <pre className="text-xs font-mono text-foreground whitespace-pre-wrap bg-secondary/50 p-3 rounded">{result.feedback.improved_pseudocode}</pre>
                        </div>
                      )}
                      {result.feedback.followup_question && (
                        <div className="p-4 rounded-lg bg-warning/5 border border-warning/20">
                          <p className="text-sm font-semibold text-foreground mb-1">🤔 Think About This</p>
                          <p className="text-sm text-foreground">{result.feedback.followup_question}</p>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Lightbulb className="w-10 h-10 mb-3 opacity-40" />
                      <p className="text-sm">Submit your code to get AI feedback</p>
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>

        {/* Right: Code Editor */}
        <div className="space-y-3">
          <Card className="overflow-hidden">
            <div className="h-[500px]">
              <Editor
                height="100%"
                defaultLanguage="python"
                theme="vs-dark"
                value={code}
                onChange={v => setCode(v || '')}
                options={{
                  fontSize: 14,
                  fontFamily: 'JetBrains Mono, monospace',
                  minimap: { enabled: false },
                  padding: { top: 16 },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  renderLineHighlight: 'all',
                  bracketPairColorization: { enabled: true },
                  automaticLayout: true,
                }}
              />
            </div>
          </Card>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full gap-2" size="lg">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {submitting ? 'Evaluating...' : 'Submit Solution'}
          </Button>
        </div>
      </div>
    </div>
  );
}
