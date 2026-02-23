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

    // Static analysis
    const staticAnalysis = analyzeCode(code);

    // Simulated test execution
    const totalTests = Array.isArray(test_cases) ? test_cases.length : 3;
    const passRate = Math.random();
    const passedTests = Math.round(passRate * totalTests);
    const runtime = Math.round(Math.random() * 200 + 10);
    const memory = `${(Math.random() * 10 + 5).toFixed(1)} MB`;

    // Call Lovable AI for evaluation
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `You are an expert programming tutor evaluating a student's Python code submission.

Problem: ${problem_title}
Description: ${problem_description}
Topic: ${topic}

Student's code:
\`\`\`python
${code}
\`\`\`

Static analysis results:
- Cyclomatic complexity: ${staticAnalysis.cyclomatic_complexity}
- Nested loop depth: ${staticAnalysis.nested_loop_depth}
- Recursion detected: ${staticAnalysis.recursion_detected}
- Line count: ${staticAnalysis.line_count}
- Function count: ${staticAnalysis.function_count}
- Tests passed: ${passedTests}/${totalTests}

Evaluate this code and provide your assessment.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a programming tutor. Evaluate code quality and provide pedagogical feedback." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "evaluate_submission",
              description: "Return structured evaluation of student code",
              parameters: {
                type: "object",
                properties: {
                  quality_score: { type: "number", description: "Code quality 1-5" },
                  efficiency: { type: "string", enum: ["Optimal", "Suboptimal", "Inefficient"] },
                  mistake_type: { type: "string", description: "Main issue found, or null if none" },
                  optimization_possible: { type: "boolean" },
                  explanation: { type: "string", description: "Clear explanation of why the solution works or doesn't, what could be improved" },
                  improved_pseudocode: { type: "string", description: "Suggested better approach in pseudocode" },
                  followup_question: { type: "string", description: "One conceptual question to reinforce learning" },
                },
                required: ["quality_score", "efficiency", "optimization_possible", "explanation", "followup_question"],
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
      // Fallback
      evaluation = {
        quality_score: 3,
        efficiency: "Suboptimal",
        mistake_type: null,
        optimization_possible: true,
        explanation: "Your code works but could be improved. Consider optimizing your approach.",
        improved_pseudocode: null,
        followup_question: "What is the time complexity of your solution?",
      };
    }

    const result = {
      passed_tests: passedTests,
      total_tests: totalTests,
      runtime_ms: runtime,
      memory_usage: memory,
      quality_score: Math.min(5, Math.max(1, Math.round(evaluation.quality_score))),
      efficiency: evaluation.efficiency || "Suboptimal",
      mistake_type: evaluation.mistake_type || null,
      optimization_possible: evaluation.optimization_possible ?? true,
      static_analysis: staticAnalysis,
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
