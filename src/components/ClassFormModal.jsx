import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { GRADE_LABELS } from '@/lib/grade-labels';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ClassFormModal({ cls, academyId, teachers, onSave, onClose }) {
  const [name, setName] = useState(cls?.name || '');
  const [mainTeacherId, setMainTeacherId] = useState(cls?.main_teacher_id || '');
  const [assistantIds, setAssistantIds] = useState(cls?.assistant_teacher_ids || []);
  const [gradeRange, setGradeRange] = useState(cls?.grade_range || '');
  const [saving, setSaving] = useState(false);

  const onlyTeachers = teachers.filter(u => u.role === 'teacher');
  const getTeacherLabel = (u) => `${u.full_name || u.email}`;

  const toggleAssistant = (id) => {
    setAssistantIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({
      name: name.trim(),
      academy_id: academyId,
      main_teacher_id: mainTeacherId || null,
      assistant_teacher_ids: assistantIds,
      grade_range: gradeRange || null,
    });
    setSaving(false);
  };

  return (
    <Modal title={cls ? '학급 수정' : '학급 추가'} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium block mb-1">학급명 *</label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="예: 중3-A반" />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">학년</label>
          <select
            value={gradeRange}
            onChange={e => setGradeRange(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">— 선택 —</option>
            {Object.entries(GRADE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">담당 강사 (선택)</label>
          <select
            value={mainTeacherId}
            onChange={e => setMainTeacherId(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
          >
            <option value="">— 미배정 —</option>
            {onlyTeachers.map(u => (
              <option key={u.id} value={u.id}>{getTeacherLabel(u)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1">보조 강사 (복수 선택 가능)</label>
          <div className="border border-border rounded-lg overflow-hidden max-h-36 overflow-y-auto">
            {onlyTeachers.length === 0 && (
              <p className="p-3 text-xs text-muted-foreground">등록된 강사가 없어요</p>
            )}
            {onlyTeachers.map(u => (
              <label key={u.id} className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={assistantIds.includes(u.id)}
                  onChange={() => toggleAssistant(u.id)}
                  disabled={u.id === mainTeacherId}
                  className="rounded"
                />
                <span className={u.id === mainTeacherId ? 'text-muted-foreground line-through' : ''}>{getTeacherLabel(u)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button className="flex-1" onClick={handleSave} disabled={saving || !name.trim()}>
          {saving ? '저장 중...' : '저장'}
        </Button>
        <Button variant="outline" onClick={onClose}>취소</Button>
      </div>
    </Modal>
  );
}