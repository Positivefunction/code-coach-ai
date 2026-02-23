import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Code2, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Problem } from '@/lib/types';

const difficultyColors: Record<string, string> = {
  easy: 'bg-success/10 text-success border-success/20',
  medium: 'bg-warning/10 text-warning border-warning/20',
  hard: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function Problems() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.from('problems').select('*').order('difficulty').then(({ data }) => {
      if (data) setProblems(data as unknown as Problem[]);
      setLoading(false);
    });
  }, []);

  const filtered = problems.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.topic.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || p.difficulty === filter;
    return matchesSearch && matchesFilter;
  });

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading problems...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Practice Problems</h1>
        <p className="text-sm text-muted-foreground">Choose a problem to practice</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search problems..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {['all', 'easy', 'medium', 'hard'].map(d => (
            <Button key={d} variant={filter === d ? 'default' : 'outline'} size="sm" onClick={() => setFilter(d)} className="capitalize">
              {d}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(`/practice?problem=${p.id}`)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Code2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{p.title}</h3>
                    <p className="text-xs text-muted-foreground">{p.topic}</p>
                  </div>
                </div>
                <Badge className={difficultyColors[p.difficulty]} variant="outline">{p.difficulty}</Badge>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No problems found. Try a different search.</p>
        )}
      </div>
    </div>
  );
}
