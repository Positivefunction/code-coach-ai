import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function analyzeCode(code: string) {
  const lines = code.split("\n").filter((l: string) => l.trim() && !l.trim().startsWith("#"));
  const lineCount = lines.length;
  const functionCount = (code.match(/\bdef\s+/g) || []).length;

  let maxNesting = 0;
  let current = 0;
  for (const line of code.split("\n")) {
    const indent = line.search(/\S/);
    if (indent >= 0) {
      current = Math.floor(indent / 4);
      if (current > maxNesting) maxNesting = current;
    }
  }

  const hasRecursion = functionCount > 0 && /\bdef\s+(\w+)[\s\S]*?\b\1\s*\(/.test(code);
  const branchCount = (code.match(/\b(if|elif|else|for|while|except)\b/g) || []).length;
  const complexity = branchCount + 1;

  return {
    cyclomatic_complexity: complexity,
    nested_loop_depth: maxNesting,
    recursion_detected: hasRecursion,
    line_count: lineCount,
    function_count: functionCount,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, problem_title, problem_description, test_cases, topic } = await req.json();

    const staticAnalysis = analyzeCode(code);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const totalTests = Array.isArray(test_cases) ? test_cases.length : 0;

    // Format test cases for the AI to evaluate
    const testCasesList = Array.isArray(test_cases)
      ? test_cases.map((tc: { input: string; expected_output: string }, i: number) =>
          `Test ${i + 1}: Input: ${tc.input} → Expected Output: ${tc.expected_output}`
        ).join("\n")
      : "No test cases provided.";

    const prompt = `You are an expert Python code executor and programming tutor. You must ACTUALLY TRACE through the student's code mentally to determine if it produces the correct output for each test case.

Problem: ${problem_title}
Description: ${problem_description}
Topic: ${topic}

Student's code:
\`\`\`python
${code}
\`\`\`

Test Cases:
${testCasesList}

Static analysis:
- Cyclomatic complexity: ${staticAnalysis.cyclomatic_complexity}
- Nested loop depth: ${staticAnalysis.nested_loop_depth}
- Recursion detected: ${staticAnalysis.recursion_detected}
- Line count: ${staticAnalysis.line_count}
- Function count: ${staticAnalysis.function_count}

IMPORTANT INSTRUCTIONS:
1. Mentally execute the student's code for EACH test case. Trace through every line.
2. If the code has syntax errors, returns None/pass, or has logic bugs, those tests MUST FAIL.
3. A function that just has "pass" or returns None should FAIL ALL tests.
4. Be strict and accurate — only mark a test as passed if the code would actually produce the exact expected output.
5. Count exactly how many tests pass and fail.
6. Estimate realistic runtime in milliseconds (simple O(n) = ~5-20ms, O(n²) = ~50-200ms, O(2^n) = ~500ms+).
7. Estimate memory usage realistically.

Provide your evaluation based on the ACTUAL behavior of the code.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a precise Python code executor. You trace through code accurately and determine test results honestly. Never say code passes if it has bugs, returns None, or just has 'pass'." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "evaluate_submission",
              description: "Return structured evaluation after tracing through the code for each test case",
              parameters: {
                type: "object",
                properties: {
                  passed_tests: { type: "number", description: "Number of tests that ACTUALLY pass when tracing through the code. 0 if code is stub/empty/has pass statement." },
                  total_tests: { type: "number", description: "Total number of test cases" },
                  test_results: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        test_number: { type: "number" },
                        passed: { type: "boolean" },
                        actual_output: { type: "string", description: "What the code actually returns for this input" },
                        expected_output: { type: "string" },
                      },
                    },
                    description: "Detailed results for each test case",
                  },
                  runtime_ms: { type: "number", description: "Estimated runtime in milliseconds" },
                  memory_mb: { type: "number", description: "Estimated memory usage in MB" },
                  quality_score: { type: "number", description: "Code quality 1-5. 1 for stubs/empty, 5 for optimal clean code." },
                  efficiency: { type: "string", enum: ["Optimal", "Suboptimal", "Inefficient"] },
                  mistake_type: { type: "string", description: "Main issue found (e.g. 'Empty implementation', 'Off-by-one error', 'Wrong algorithm'), or null if none" },
                  optimization_possible: { type: "boolean" },
                  explanation: { type: "string", description: "Clear explanation of what the code does, whether it works, and what could be improved" },
                  improved_pseudocode: { type: "string", description: "Suggested better approach in pseudocode" },
                  followup_question: { type: "string", description: "One conceptual question to reinforce learning" },
                },
                required: ["passed_tests", "total_tests", "test_results", "runtime_ms", "memory_mb", "quality_score", "efficiency", "optimization_possible", "explanation", "followup_question"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "evaluate_submission" } },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResponse.json();
    let evaluation;

    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      evaluation = JSON.parse(toolCall.function.arguments);
    } catch {
      evaluation = {
        passed_tests: 0,
        total_tests: totalTests,
        test_results: [],
        runtime_ms: 0,
        memory_mb: 5,
        quality_score: 1,
        efficiency: "Inefficient",
        mistake_type: "Unable to evaluate",
        optimization_possible: true,
        explanation: "Could not evaluate your code. Please check for syntax errors and try again.",
        improved_pseudocode: null,
        followup_question: "What is the expected output of your function?",
      };
    }

    const passedTests = Math.min(totalTests, Math.max(0, evaluation.passed_tests));
    const qualityScore = Math.min(5, Math.max(1, Math.round(evaluation.quality_score)));
    const runtime = Math.max(1, Math.round(evaluation.runtime_ms || 0));
    const memory = `${(evaluation.memory_mb || 5).toFixed(1)} MB`;

    // Calculate gamification points
    const testPoints = passedTests * 10;
    const qualityPoints = qualityScore * 5;
    const efficiencyBonus = evaluation.efficiency === "Optimal" ? 20 : evaluation.efficiency === "Suboptimal" ? 10 : 0;
    const perfectBonus = passedTests === totalTests && totalTests > 0 ? 25 : 0;
    const earnedPoints = testPoints + qualityPoints + efficiencyBonus + perfectBonus;

    const result = {
      passed_tests: passedTests,
      total_tests: totalTests,
      runtime_ms: runtime,
      memory_usage: memory,
      quality_score: qualityScore,
      efficiency: evaluation.efficiency || "Suboptimal",
      mistake_type: evaluation.mistake_type || null,
      optimization_possible: evaluation.optimization_possible ?? true,
      static_analysis: staticAnalysis,
      points_earned: earnedPoints,
      test_results: evaluation.test_results || [],
      feedback: {
        explanation: evaluation.explanation,
        improved_pseudocode: evaluation.improved_pseudocode || null,
        followup_question: evaluation.followup_question,
        topic,
      },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evaluate-code error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
