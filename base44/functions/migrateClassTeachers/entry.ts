import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const allClasses = await base44.asServiceRole.entities.Class.list('name', 1000);
    let migrated = 0;
    let skipped = 0;

    for (const cls of allClasses) {
      // If old teacher_id exists and main_teacher_id not yet set
      if (cls.teacher_id && !cls.main_teacher_id) {
        await base44.asServiceRole.entities.Class.update(cls.id, {
          main_teacher_id: cls.teacher_id,
          assistant_teacher_ids: cls.assistant_teacher_ids || [],
        });
        migrated++;
      } else if (!cls.main_teacher_id) {
        // Ensure assistant_teacher_ids is initialized
        if (!cls.assistant_teacher_ids) {
          await base44.asServiceRole.entities.Class.update(cls.id, {
            assistant_teacher_ids: [],
          });
        }
        skipped++;
      } else {
        skipped++;
      }
    }

    return Response.json({
      total: allClasses.length,
      migrated,
      skipped,
      message: `teacher_id → main_teacher_id 마이그레이션 완료`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});