import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);

    const toMigrate = allUsers.filter(u => u.role === 'user' || !u.role);
    const skippedAdmins = allUsers.filter(u => u.role === 'admin');
    const skippedTeachers = allUsers.filter(u => u.role === 'teacher');

    const results = toMigrate.map(u => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      old_role: u.role || '(empty)',
      new_role: 'student',
    }));

    if (!dryRun) {
      for (const u of toMigrate) {
        await base44.asServiceRole.entities.User.update(u.id, { role: 'student' });
      }
    }

    return Response.json({
      dry_run: dryRun,
      migrated: dryRun ? 0 : toMigrate.length,
      would_migrate: toMigrate.length,
      skipped_admins: skippedAdmins.length,
      skipped_teachers: skippedTeachers.length,
      results,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});