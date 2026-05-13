import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTeacher } from '@/lib/TeacherContext';
import { useAuth } from '@/lib/AuthContext';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, User } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function TeacherStudents() {
  const navigate = useNavigate();
  const { data, loading, refresh } = useTeacher();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState(
    new URLSearchParams(window.location.search).get('class_id') || 'all'
  );
  const [changingClass, setChangingClass] = useState({}); // { studentId: true }

  const handleClassChange = async (student, newClassId) => {
    setChangingClass(prev => ({ ...prev, [student.id]: true }));
    try {
      await base44.entities.User.update(student.id, { class_id: newClassId || null });
      const newClass = data?.my_classes?.find(c => c.id === newClassId);
      toast.success(`${student.full_name || student.email}을(를) ${newClass?.name || '미배정'}으로 옮겼어요`);
      refresh();
    } finally {
      setChangingClass(prev => ({ ...prev, [student.id]: false }));
    }
  };

  if (loading) return <InlineLoader message="학생 목록 불러오는 중..." />;
  if (!data) return <InlineLoader message="초기화 중..." />;

  const { my_classes, my_students } = data;
  // my_classes를 아래 select에서도 사용

  if (my_classes.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="font-semibold">담당 학급이 없어요</p>
        <p className="text-sm mt-1">관리자에게 학급 배정을 요청해 주세요.</p>
      </div>
    );
  }

  const filtered = my_students
    .filter(u => classFilter === 'all' || u.class_id === classFilter)
    .filter(u => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
    });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">내 학생들</h1>
        <p className="text-muted-foreground text-sm mt-1">담당 학급의 학생 {my_students.length}명</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setClassFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            classFilter === 'all' ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >전체</button>
        {my_classes.map(c => (
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

      <p className="text-xs text-muted-foreground">다른 학급으로 보내려면 학원장께 요청하세요</p>

      <div className="space-y-2">
        {filtered.map(u => (
          <Card key={u.id} className="p-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                onClick={() => navigate(`/teacher/students/${u.id}`)}>
                <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-violet-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{u.full_name || '(이름 없음)'}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.class_name}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <div className="text-right">
                  <p className="text-sm font-semibold">{u.attempt_count}회</p>
                  <p className="text-xs text-muted-foreground">{u.avg_score > 0 ? `평균 ${u.avg_score}점` : '시도 없음'}</p>
                </div>
                <select
                  value={u.class_id || ''}
                  disabled={changingClass[u.id]}
                  onChange={e => handleClassChange(u, e.target.value || null)}
                  onClick={e => e.stopPropagation()}
                  className="text-xs h-7 px-2 rounded-md border border-input bg-background disabled:opacity-50"
                >
                  <option value="">(학급 빼기)</option>
                  {my_classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">해당하는 학생이 없어요</div>
        )}
      </div>
    </div>
  );
}