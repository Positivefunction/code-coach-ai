import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { motion } from 'framer-motion';
import { Trophy, Medal, Star, Flame, Crown, TrendingUp } from 'lucide-react';

interface LeaderboardEntry {
  user_id: string;
  name: string;
  points: number;
  submissions_count: number;
  avg_quality: number;
  rank: number;
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
  return <span className="text-sm font-bold text-muted-foreground w-5 text-center">{rank}</span>;
}

function getLevel(points: number) {
  if (points >= 1000) return { label: 'Master', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
  if (points >= 500) return { label: 'Expert', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
  if (points >= 200) return { label: 'Advanced', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  if (points >= 50) return { label: 'Intermediate', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
  return { label: 'Beginner', color: 'bg-muted text-muted-foreground border-border' };
}

export default function Leaderboard() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myStats, setMyStats] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    const load = async () => {
      // Get all profiles with their points
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, skill_profile');

      if (!profiles) { setLoading(false); return; }

      // Get submission counts and avg quality per user
      const { data: submissions } = await supabase
        .from('submissions')
        .select('user_id, quality_score');

      const userStats: Record<string, { count: number; totalQuality: number }> = {};
      (submissions || []).forEach((s: { user_id: string; quality_score: number | null }) => {
        if (!userStats[s.user_id]) userStats[s.user_id] = { count: 0, totalQuality: 0 };
        userStats[s.user_id].count++;
        userStats[s.user_id].totalQuality += s.quality_score || 0;
      });

      const leaderboard: LeaderboardEntry[] = profiles
        .map((p) => {
          const sp = p.skill_profile as Record<string, unknown> | null;
          const points = (sp?.points as number) || 0;
          const stats = userStats[p.user_id] || { count: 0, totalQuality: 0 };
          return {
            user_id: p.user_id,
            name: p.name || 'Anonymous',
            points,
            submissions_count: stats.count,
            avg_quality: stats.count > 0 ? +(stats.totalQuality / stats.count).toFixed(1) : 0,
            rank: 0,
          };
        })
        .sort((a, b) => b.points - a.points)
        .map((e, i) => ({ ...e, rank: i + 1 }));

      setEntries(leaderboard);
      if (user) {
        setMyStats(leaderboard.find(e => e.user_id === user.id) || null);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading leaderboard...</div>;
  }

  const topThree = entries.slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">Compete with fellow students and climb the ranks</p>
      </div>

      {/* My stats card */}
      {myStats && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Star className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Your Rank</p>
                    <p className="text-2xl font-bold text-foreground">#{myStats.rank}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Points</p>
                    <p className="text-lg font-bold text-primary">{myStats.points}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Level</p>
                    <Badge className={getLevel(myStats.points).color}>{getLevel(myStats.points).label}</Badge>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Submissions</p>
                    <p className="text-lg font-bold text-foreground">{myStats.submissions_count}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Top 3 podium */}
      {topThree.length >= 3 && (
        <div className="grid grid-cols-3 gap-4">
          {[topThree[1], topThree[0], topThree[2]].map((entry, i) => {
            const podiumOrder = [2, 1, 3];
            const heights = ['h-28', 'h-36', 'h-24'];
            const colors = ['from-gray-400/20 to-gray-600/10', 'from-yellow-400/20 to-yellow-600/10', 'from-amber-700/20 to-amber-900/10'];
            return (
              <motion.div
                key={entry.user_id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
                className="flex flex-col items-center"
              >
                <Card className={`w-full bg-gradient-to-b ${colors[i]} border-border/50`}>
                  <CardContent className={`${heights[i]} flex flex-col items-center justify-center p-4`}>
                    {getRankIcon(podiumOrder[i])}
                    <p className="text-sm font-bold text-foreground mt-2 truncate max-w-full">{entry.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Flame className="w-3.5 h-3.5 text-primary" />
                      <span className="text-sm font-semibold text-primary">{entry.points} pts</span>
                    </div>
                    <Badge className={`mt-1 text-[10px] ${getLevel(entry.points).color}`}>{getLevel(entry.points).label}</Badge>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Full rankings table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" /> Full Rankings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-center">Level</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Submissions</TableHead>
                  <TableHead className="text-right">Avg Quality</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow
                    key={entry.user_id}
                    className={entry.user_id === user?.id ? 'bg-primary/5' : ''}
                  >
                    <TableCell>
                      <div className="flex items-center justify-center">{getRankIcon(entry.rank)}</div>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {entry.name}
                      {entry.user_id === user?.id && <span className="text-xs text-muted-foreground ml-2">(You)</span>}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-[10px] ${getLevel(entry.points).color}`}>{getLevel(entry.points).label}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">{entry.points}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{entry.submissions_count}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{entry.avg_quality}/5</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">No students ranked yet. Start practicing!</p>
          )}
        </CardContent>
      </Card>

      {/* Points guide */}
      <Card>
        <CardHeader><CardTitle className="text-base">How Points Work</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: '✅', label: 'Test Passed', value: '+10 pts each' },
              { icon: '⭐', label: 'Quality Score', value: '+5 pts per point' },
              { icon: '⚡', label: 'Optimal Solution', value: '+20 bonus' },
              { icon: '🏆', label: 'All Tests Passed', value: '+25 bonus' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                <span className="text-xl">{item.icon}</span>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
