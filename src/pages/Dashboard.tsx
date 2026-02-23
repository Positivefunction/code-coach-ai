import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Target, TrendingUp, AlertTriangle, Zap, BookOpen, Award } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import type { Submission, SkillProfile } from '@/lib/types';

const TOPICS = ['Arrays', 'Strings', 'Loops', 'Recursion', 'Sorting', 'Dynamic Programming'];
const TOPIC_COLORS: Record<string, string> = {
  Arrays: 'hsl(250, 80%, 65%)',
  Strings: 'hsl(170, 70%, 50%)',
  Loops: 'hsl(38, 92%, 55%)',
  Recursion: 'hsl(0, 72%, 55%)',
  Sorting: 'hsl(200, 70%, 55%)',
  'Dynamic Programming': 'hsl(280, 60%, 55%)',
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [profile, setProfile] = useState<{ skill_profile: SkillProfile } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [subRes, profRes] = await Promise.all([
        supabase.from('submissions').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('profiles').select('skill_profile').eq('user_id', user.id).single(),
      ]);
      if (subRes.data) setSubmissions(subRes.data as unknown as Submission[]);
      if (profRes.data) setProfile(profRes.data as unknown as { skill_profile: SkillProfile });
      setLoading(false);
    };
    load();
  }, [user]);

  const totalSubmissions = submissions.length;
  const avgQuality = totalSubmissions > 0
    ? (submissions.reduce((sum, s) => sum + (s.quality_score || 0), 0) / totalSubmissions).toFixed(1)
    : '0';
  const accuracy = totalSubmissions > 0
    ? Math.round((submissions.filter(s => s.passed_tests === s.total_tests).length / totalSubmissions) * 100)
    : 0;

  const mistakeCounts: Record<string, number> = {};
  submissions.forEach(s => {
    if (s.mistake_type) mistakeCounts[s.mistake_type] = (mistakeCounts[s.mistake_type] || 0) + 1;
  });
  const topMistake = Object.entries(mistakeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None yet';

  const qualityTrend = submissions.slice(-15).map((s, i) => ({
    idx: i + 1,
    quality: s.quality_score || 0,
    tests: s.total_tests > 0 ? Math.round((s.passed_tests / s.total_tests) * 100) : 0,
  }));

  const topicData = TOPICS.map(t => {
    const topicSubs = submissions.filter(s => {
      const fb = s.feedback as Record<string, unknown>;
      return fb?.topic === t;
    });
    return { topic: t, count: topicSubs.length, avgScore: topicSubs.length > 0
      ? +(topicSubs.reduce((a, b) => a + (b.quality_score || 0), 0) / topicSubs.length).toFixed(1)
      : 0,
    };
  });

  const stats = [
    { icon: Target, label: 'Accuracy', value: `${accuracy}%`, color: 'text-success' },
    { icon: TrendingUp, label: 'Avg Quality', value: `${avgQuality}/5`, color: 'text-primary' },
    { icon: AlertTriangle, label: 'Top Mistake', value: topMistake, color: 'text-warning' },
    { icon: Award, label: 'Submissions', value: `${totalSubmissions}`, color: 'text-accent' },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Track your learning progress</p>
        </div>
        <Button onClick={() => navigate('/problems')} className="gap-2">
          <BookOpen className="w-4 h-4" /> Practice Now
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    <s.icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-lg font-bold text-foreground truncate max-w-[120px]">{s.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Quality Trend */}
        <Card>
          <CardHeader><CardTitle className="text-base">Quality & Accuracy Trend</CardTitle></CardHeader>
          <CardContent>
            {qualityTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={qualityTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="idx" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                  <Line type="monotone" dataKey="quality" stroke="hsl(var(--primary))" strokeWidth={2} name="Quality Score" />
                  <Line type="monotone" dataKey="tests" stroke="hsl(var(--accent))" strokeWidth={2} name="Test Pass %" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">Submit solutions to see trends</div>
            )}
          </CardContent>
        </Card>

        {/* Topic Heatmap */}
        <Card>
          <CardHeader><CardTitle className="text-base">Skill Heatmap by Topic</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topicData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis type="category" dataKey="topic" stroke="hsl(var(--muted-foreground))" fontSize={11} width={100} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                <Bar dataKey="avgScore" name="Avg Score" radius={[0, 4, 4, 0]}>
                  {topicData.map((entry) => (
                    <Cell key={entry.topic} fill={TOPIC_COLORS[entry.topic] || 'hsl(var(--primary))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent submissions */}
      <Card>
        <CardHeader><CardTitle className="text-base">Recent Submissions</CardTitle></CardHeader>
        <CardContent>
          {submissions.length > 0 ? (
            <div className="space-y-3">
              {submissions.slice(-5).reverse().map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${s.passed_tests === s.total_tests ? 'bg-success' : 'bg-destructive'}`} />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {s.passed_tests}/{s.total_tests} tests passed
                      </p>
                      <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.quality_score && <Badge variant="secondary">Quality: {s.quality_score}/5</Badge>}
                    {s.efficiency && <Badge variant={s.efficiency === 'Optimal' ? 'default' : 'secondary'}>{s.efficiency}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No submissions yet. Start practicing!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
