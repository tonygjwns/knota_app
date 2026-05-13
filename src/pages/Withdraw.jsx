import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

export default function Withdraw() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState('');
  const [processing, setProcessing] = useState(false);

  const isConfirmed = confirm === '탈퇴';

  const handleWithdraw = async () => {
    setProcessing(true);
    try {
      const [probBookmarks, toolBookmarks, feedbacks] = await Promise.all([
        base44.entities.BookmarkedProblem.filter({ user_id: user.id }, '', 1000),
        base44.entities.BookmarkedTool.filter({ user_id: user.id }, '', 1000),
        base44.entities.RecommendationFeedback.filter({ user_id: user.id }, '', 1000),
      ]);
      for (const b of probBookmarks) await base44.entities.BookmarkedProblem.delete(b.id);
      for (const b of toolBookmarks) await base44.entities.BookmarkedTool.delete(b.id);
      for (const f of feedbacks) await base44.entities.RecommendationFeedback.delete(f.id);
      base44.auth.logout('/');
    } catch (e) {
      toast.error('탈퇴 처리 중 오류: ' + e.message);
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-foreground">회원 탈퇴</h1>
        </div>

        {/* 경고 카드 */}
        <Card className="p-5 border-destructive/30 bg-destructive/5 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive mb-1">탈퇴하시면 다음 데이터가 삭제됩니다</p>
              <ul className="text-sm text-foreground space-y-1 list-disc ml-4">
                <li>즐겨찾기한 문제</li>
                <li>즐겨찾기한 도구</li>
                <li>추천 피드백 기록</li>
              </ul>
              <p className="text-sm text-muted-foreground mt-3">
                * 학습 기록(풀이 기록)은 강사 통계 목적으로 보존됩니다.
              </p>
            </div>
          </div>
          <div className="bg-destructive/10 rounded-lg p-3">
            <p className="text-sm font-semibold text-destructive text-center">이 작업은 되돌릴 수 없습니다</p>
          </div>
        </Card>

        {/* 본인 확인 */}
        <div className="space-y-3 mb-6">
          <label className="text-sm font-medium text-foreground block">
            탈퇴를 진행하려면 아래에 <strong>"탈퇴"</strong>를 입력하세요
          </label>
          <Input
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="탈퇴"
            className={isConfirmed ? 'border-destructive focus-visible:ring-destructive' : ''}
          />
        </div>

        {/* 버튼 */}
        <div className="flex flex-col gap-2">
          <Button
            variant="destructive"
            className="w-full"
            disabled={!isConfirmed || processing}
            onClick={handleWithdraw}
          >
            {processing ? '처리 중...' : '탈퇴 진행'}
          </Button>
          <Button variant="outline" className="w-full" onClick={() => navigate(-1)}>
            취소
          </Button>
        </div>
      </div>
    </div>
  );
}