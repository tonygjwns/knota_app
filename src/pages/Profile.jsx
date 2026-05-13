import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { LogOut, ArrowLeft } from 'lucide-react';

const GRADE_OPTIONS = [
  { value: '', label: '선택 안 함' },
  { value: '1', label: '초등 1학년' },
  { value: '2', label: '초등 2학년' },
  { value: '3', label: '초등 3학년' },
  { value: '4', label: '초등 4학년' },
  { value: '5', label: '초등 5학년' },
  { value: '6', label: '초등 6학년' },
  { value: '7', label: '중학교 1학년' },
  { value: '8', label: '중학교 2학년' },
  { value: '9', label: '중학교 3학년' },
  { value: '10', label: '고등학교 1학년' },
  { value: '11', label: '고등학교 2학년' },
  { value: '12', label: '고등학교 3학년' },
];

const ROLE_LABELS = { admin: '관리자', teacher: '강사', student: '학생' };
const APPROVAL_LABELS = { pending: '승인 대기', approved: '승인됨', rejected: '거절됨' };

export default function Profile() {
  const { user, checkUserAuth } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [grade, setGrade] = useState('');
  const [saving, setSaving] = useState(false);
  const [orgInfo, setOrgInfo] = useState({ academy: null, cls: null });

  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name || '');
    setGrade(user.grade || '');
    loadOrgInfo();
  }, [user]);

  const loadOrgInfo = async () => {
    if (!user?.academy_id && !user?.class_id) return;
    try {
      const [academies, classes] = await Promise.all([
        user.academy_id ? base44.entities.Academy.list('name', 200) : Promise.resolve([]),
        user.class_id ? base44.entities.Class.list('name', 500) : Promise.resolve([]),
      ]);
      setOrgInfo({
        academy: academies.find(a => a.id === user.academy_id) || null,
        cls: classes.find(c => c.id === user.class_id) || null,
      });
    } catch { /* silent */ }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ full_name: fullName, grade });
      await checkUserAuth();
      toast.success('저장됐어요');
    } catch (e) {
      toast.error('저장에 실패했어요');
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';

  const content = (
    <div className="space-y-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-foreground">내 정보 관리</h1>

      {/* 편집 가능 영역 */}
      <Card className="p-5 space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground block mb-1.5">이름</label>
          <Input
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="이름 입력"
          />
        </div>

        {!isAdmin && (
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">학년</label>
            <select
              value={grade}
              onChange={e => setGrade(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {GRADE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? '저장 중...' : '저장'}
        </Button>
      </Card>

      {/* 읽기 전용 영역 */}
      <Card className="p-5 space-y-3 bg-muted/40">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">계정 정보 (읽기 전용)</p>

        <InfoRow label="이메일" value={user?.email} note="Google 계정" />
        <InfoRow label="역할" value={ROLE_LABELS[user?.role] || user?.role} />
        {orgInfo.academy && <InfoRow label="학원" value={orgInfo.academy.name} />}
        {isStudent && orgInfo.cls && <InfoRow label="학급" value={orgInfo.cls.name} />}
        {isStudent && (
          <InfoRow
            label="승인 상태"
            value={APPROVAL_LABELS[user?.approval_status] || user?.approval_status}
          />
        )}
        {user?.created_date && (
          <InfoRow
            label="가입일"
            value={new Date(user.created_date).toLocaleDateString('ko-KR')}
          />
        )}
      </Card>

      {/* 로그아웃 */}
      <Button
        variant="destructive"
        className="w-full"
        onClick={() => base44.auth.logout('/')}
      >
        <LogOut className="w-4 h-4 mr-2" />
        로그아웃
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="w-full mt-2 text-xs text-muted-foreground hover:text-destructive"
        onClick={() => navigate('/withdraw')}
      >
        회원 탈퇴
      </Button>
    </div>
  );

  // admin/teacher는 AppLayout 없이 자체 래퍼
  if (!isStudent) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-lg mx-auto px-4 py-8">
          <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            뒤로가기
          </button>
          {content}
        </div>
      </div>
    );
  }

  return <AppLayout>{content}</AppLayout>;
}

function InfoRow({ label, value, note }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground flex-shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right">
        {value || '-'}
        {note && <span className="ml-1 text-xs text-muted-foreground">({note})</span>}
      </span>
    </div>
  );
}