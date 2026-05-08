import React from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ClassSelectDialog({ classes, onSelect, onClose }) {
  return (
    <AlertDialog open onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogTitle>어느 학급에 출제할까요?</AlertDialogTitle>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {classes.map(c => (
            <Button
              key={c.id}
              variant="outline"
              className="w-full justify-start"
              onClick={() => onSelect(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}