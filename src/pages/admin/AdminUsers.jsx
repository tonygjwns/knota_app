import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronRight, User } from 'lucide-react';

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [u, a] = await Promise.all([
        base44.entities.User.list('-created_date', 100),
        base44.entities.StudentAttempt.list('-submitted_at', 500),
      ]);
      setUsers(u);
      setAttempts(a);
    } finally {
      setLoading(false);
    }
  };

  const getUserStats = (userId) => {
    const userAttempts = attempts.filter(a => a.student_id === userId);
    if (userAttempts.length === 0) return { count: 0, avg: 0, last: null };
    const avg = Math.round(userAttempts.reduce((s, a) => s + (a.score || 0), 0) / userAttempts.length);
    const last = userAttempts.sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))[0];
    return { count: userAttempts.length, avg, last: last?.submitted_at };
  };

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });

  if (loading) return <InlineLoader message="학생 목록 불러오는 중..." />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">학생 목록</h1>
        <p className="text-muted-foreground text-sm mt-1">{users.length}명의 학생</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="이름 또는 이메일 검색..."
          className="pl-10"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {filtered.map(u => {
          const stats = getUserStats(u.id);
          return (
            <Card key={u.id} className="p-4 flex items-center justify-between gap-3 card-hover">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{u.full_name || '(이름 없음)'}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  {u.role === 'admin' && (
                    <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">관리자</span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold">{stats.count}회</p>
                <p className="text-xs text-muted-foreground">
                  {stats.avg > 0 ? `평균 ${stats.avg}점` : '시도 없음'}
                </p>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">검색 결과가 없어요</div>
        )}
      </div>
    </div>
  );
}