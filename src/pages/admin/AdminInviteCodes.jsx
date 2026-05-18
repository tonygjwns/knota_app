import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InlineLoader } from '@/components/LoadingOverlay';
import { Copy, Plus, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

function generateCode(length = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const ROLE_CFG = {
  owner:   { label: '학원장', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  teacher: { label: '강사',   color: 'bg-blue-100 text-blue-700 border-blue-200' },
  student: { label: '학생',   color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

// role -> type 매핑: owner는 academy 코드, teacher/student는 둘 다 가능
const CREATABLE_ROLES = [
  { role: 'owner',   label: '학원장 (일회용)', oneTime: true,  type: 'academy' },
  { role: 'teacher', label: '강사 (학원)',      oneTime: false, type: 'academy' },
  { role: 'student', label: '학생 (학원)',      oneTime: false, type: 'academy' },
  { role: 'teacher', label: '강사 (학급)',      oneTime: false, type: 'class',   needsClass: true },
  { role: 'student', label: '학생 (학급)',      oneTime: false, type: 'class',   needsClass: true },
];

export default function AdminInviteCodes() {
  const { user } = useAuth();
  const [codes, setCodes] = useState([]);
  const [academies, setAcademies] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAcademyId, setSelectedAcademyId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [c, a, cl] = await Promise.all([
      base44.entities.InviteCode.list('-created_date', 200),
      base44.entities.Academy.list('name', 200),
      base44.entities.Class.list('name', 500),
    ]);
    setCodes(c);
    setAcademies(a);
    setClasses(cl);
    setLoading(false);
  };

  const filteredClasses = selectedAcademyId
    ? classes.filter(c => c.academy_id === selectedAcademyId)
    : [];

  const getAcademyName = (id) => academies.find(a => a.id === id)?.name || id;
  const getClassName = (id) => classes.find(c => c.id === id)?.name || id;

  const createCode = async ({ role, oneTime, type, needsClass }) => {
    if (!selectedAcademyId) { toast.error('학원을 먼저 선택해 주세요'); return; }
    if (needsClass && !selectedClassId) { toast.error('학급을 먼저 선택해 주세요'); return; }
    setCreating(true);
    const code = generateCode(6);
    const newCode = await base44.entities.InviteCode.create({
      code,
      type,
      academy_id: selectedAcademyId,
      class_id: needsClass ? selectedClassId : null,
      role,
      issued_by: user.id,
      is_active: true,
      one_time: !!oneTime,
      use_count: 0,
    });
    setCodes(prev => [newCode, ...prev]);
    toast.success(`코드 생성됨: ${code}`);
    setCreating(false);
  };

  const deleteCode = async (id) => {
    if (!confirm('이 초대코드를 삭제할까요? 되돌릴 수 없어요.')) return;
    try {
      await base44.entities.InviteCode.delete(id);
      setCodes(prev => prev.filter(c => c.id !== id));
      toast.success('코드를 삭제했어요');
    } catch (e) {
      toast.error('삭제 실패: ' + (e.message || ''));
    }
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success('코드 복사됨');
  };

  if (loading) return <InlineLoader message="초대코드 불러오는 중..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">초대코드 관리</h1>
          <p className="text-muted-foreground text-sm mt-1">학원장·강사·학생 초대코드를 발행·관리해요</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll}>
          <RefreshCw className="w-4 h-4 mr-1" /> 새로고침
        </Button>
      </div>

      {/* 코드 발행 */}
      <Card className="p-5 space-y-4">
        <h2 className="font-semibold">새 코드 발행</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium block mb-1">학원 선택 *</label>
            <select
              value={selectedAcademyId}
              onChange={e => { setSelectedAcademyId(e.target.value); setSelectedClassId(''); }}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="">— 학원 선택 —</option>
              {academies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1">학급 선택 (학급 코드용)</label>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              disabled={!selectedAcademyId}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm disabled:opacity-50"
            >
              <option value="">— 학급 선택 (선택) —</option>
              {filteredClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {CREATABLE_ROLES.map((cfg, i) => (
            <Button
              key={i}
              size="sm"
              variant="outline"
              disabled={creating}
              onClick={() => createCode(cfg)}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {cfg.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* 코드 목록 */}
      <div className="space-y-2">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          전체 코드 ({codes.length})
        </h2>
        {codes.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">아직 발행된 코드가 없어요</p>
        )}
        {codes.map(c => {
          const roleCfg = ROLE_CFG[c.role] || ROLE_CFG.student;
          return (
            <Card key={c.id} className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-mono font-bold text-lg tracking-widest">{c.code}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${roleCfg.color}`}>{roleCfg.label}</span>
                  {c.one_time && <span className="text-xs px-2 py-0.5 rounded-full border bg-amber-50 text-amber-600 border-amber-200">일회용</span>}
                  <div className="text-xs text-muted-foreground">
                    {getAcademyName(c.academy_id)}
                    {c.class_id && ` › ${getClassName(c.class_id)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{c.use_count || 0}회 사용</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyCode(c.code)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteCode(c.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}