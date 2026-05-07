import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate } from 'react-router-dom';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Card } from '@/components/ui/card';
import { BookOpen, Users, ChevronRight } from 'lucide-react';

export default function TeacherClasses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [myClasses, setMyClasses] = useState([]);
  const [academies, setAcademies] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [studentCounts, setStudentCounts] = useState({});

  useEffect(() => { loadData(); }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const [allClasses, acad, users] = await Promise.all([
      base44.entities.Class.list('name', 500),
      base44.entities.Academy.list('name', 200),
      base44.entities.User.list('-created_date', 1000),
    ]);

    const mine = allClasses.filter(c =>
      c.main_teacher_id === user.id ||
      (c.assistant_teacher_ids || []).includes(user.id)
    );
    setMyClasses(mine);
    setAcademies(acad);
    setAllUsers(users);

    const counts = {};
    mine.forEach(c => {
      counts[c.id] = users.filter(u => u.class_id === c.id).length;
    });
    setStudentCounts(counts);
    setLoading(false);
  };

  const getAcademyName = (id) => academies.find(a => a.id === id)?.name || '—';
  const getUserName = (id) => {
    const u = allUsers.find(u => u.id === id);
    return u ? (u.full_name || u.email) : null;
  };

  if (loading) return <InlineLoader message="학급 목록 불러오는 중..." />;

  if (myClasses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <BookOpen className="w-12 h-12 text-muted-foreground opacity-30" />
        <p className="text-lg font-semibold text-muted-foreground">담당 학급이 없어요</p>
        <p className="text-sm text-muted-foreground">관리자에게 학급 배정을 요청해 주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">내 학급</h1>
        <p className="text-muted-foreground text-sm mt-1">담당 학급 {myClasses.length}개</p>
      </div>

      <div className="space-y-3">
        {myClasses.map(cls => (
          <Card
            key={cls.id}
            onClick={() => navigate(`/teacher/students?class_id=${cls.id}`)}
            className="p-4 cursor-pointer hover:shadow-md transition-all"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="font-semibold">{cls.name}</p>
                  <p className="text-xs text-muted-foreground">{getAcademyName(cls.academy_id)}</p>
                  {getUserName(cls.main_teacher_id) ? (
                    <p className="text-xs text-muted-foreground">담당: {getUserName(cls.main_teacher_id)}</p>
                  ) : (
                    <p className="text-xs text-amber-600">담당 미배정</p>
                  )}
                  {(cls.assistant_teacher_ids || []).length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      보조: {cls.assistant_teacher_ids.map(id => getUserName(id)).filter(Boolean).join(', ')}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-0.5">
                    {cls.grade_range && <span className="text-xs text-muted-foreground">{cls.grade_range}</span>}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> {studentCounts[cls.id] || 0}명
                    </span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}