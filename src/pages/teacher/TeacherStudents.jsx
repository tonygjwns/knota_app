import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeacher } from '@/lib/TeacherContext';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, User } from 'lucide-react';

export default function TeacherStudents() {
  const navigate = useNavigate();
  const { myClasses, students, attempts, loading } = useTeacher();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState(
    new URLSearchParams(window.location.search).get('class_id') || 'all'
  );

  const getStats = (userId) => {
    const ua = attempts.filter(a => a.student_id === userId);
    if (!ua.length) return { count: 0, avg: 0 };
    return { count: ua.length, avg: Math.round(ua.reduce((s, a) => s + (a.score || 0), 0) / ua.length) };
  };

  const getClassName = (classId) => myClasses.find(c => c.id === classId)?.name || '—';

  const filtered = students
    .filter(u => classFilter === 'all' || u.class_id === classFilter)
    .filter(u => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
    });

  if (loading) return <InlineLoader message="학생 목록 불러오는 중..." />;

  if (myClasses.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="font-semibold">담당 학급이 없어요</p>
        <p className="text-sm mt-1">관리자에게 학급 배정을 요청해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">내 학생들</h1>
        <p className="text-muted-foreground text-sm mt-1">담당 학급의 학생 {students.length}명</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setClassFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            classFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >전체</button>
        {myClasses.map(c => (
          <button key={c.id} onClick={() => setClassFilter(c.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              classFilter === c.id ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="이름 또는 이메일 검색..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="space-y-2">
        {filtered.map(u => {
          const stats = getStats(u.id);
          return (
            <Card key={u.id} className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => navigate(`/teacher/students/${u.id}`)}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-violet-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">{u.full_name || '(이름 없음)'}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    <p className="text-xs text-muted-foreground">{getClassName(u.class_id)}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold">{stats.count}회</p>
                  <p className="text-xs text-muted-foreground">{stats.avg > 0 ? `평균 ${stats.avg}점` : '시도 없음'}</p>
                </div>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">해당하는 학생이 없어요</div>
        )}
      </div>
    </div>
  );
}