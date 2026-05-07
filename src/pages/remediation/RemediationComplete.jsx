import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Home, Wrench } from 'lucide-react';

export default function RemediationComplete() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Trophy className="w-10 h-10 text-primary" />
        </div>
        
        <div>
          <h1 className="text-2xl font-bold mb-2">🎉 매듭 보강 완료!</h1>
          <p className="text-muted-foreground">3 단계를 모두 완료했어요. 대단해요!</p>
        </div>

        <div className="flex gap-3">
          <Button size="lg" className="flex-1" onClick={() => navigate('/home')}>
            <Home className="w-4 h-4 mr-2" />
            자유 풀이로
          </Button>
          <Button size="lg" variant="outline" className="flex-1" onClick={() => navigate('/problems')}>
            <Wrench className="w-4 h-4 mr-2" />
            다른 약점 보강
          </Button>
        </div>
      </Card>
    </div>
  );
}