import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const [types, problems, problemTypes] = await Promise.all([
      base44.asServiceRole.entities.Type.list('name', 500),
      base44.asServiceRole.entities.Problem.list('-created_date', 5000),
      base44.asServiceRole.entities.ProblemType.list('-created_date', 10000),
    ]);

    const problemMap = new Map(problems.map(p => [p.problem_id, p]));
    const problemsByType = new Map();
    for (const pt of problemTypes) {
      if (!problemsByType.has(pt.type_id)) problemsByType.set(pt.type_id, new Set());
      problemsByType.get(pt.type_id).add(pt.problem_id);
    }

    const existing = await base44.asServiceRole.entities.TypeToolMap.list('-updated_at', 1000);
    const existingByTypeId = new Map(existing.map(e => [e.type_id, e]));

    const now = new Date().toISOString();
    let createdCount = 0, updatedCount = 0;

    for (const type of types) {
      const probIds = problemsByType.get(type.type_id) || new Set();
      const toolIds = new Set();
      const toolProbCounts = {};

      for (const probId of probIds) {
        const problem = problemMap.get(probId);
        if (!problem?.tool_ids) continue;
        try {
          const parsed = JSON.parse(problem.tool_ids);
          if (!Array.isArray(parsed)) continue;
          for (const tid of parsed) {
            if (!tid) continue;
            toolIds.add(tid);
            toolProbCounts[tid] = (toolProbCounts[tid] || 0) + 1;
          }
        } catch {}
      }

      const payload = {
        type_id: type.type_id,
        tool_ids: JSON.stringify([...toolIds]),
        problem_count: probIds.size,
        tool_problem_counts: JSON.stringify(toolProbCounts),
        updated_at: now,
      };

      const existingEntry = existingByTypeId.get(type.type_id);
      if (existingEntry) {
        await base44.asServiceRole.entities.TypeToolMap.update(existingEntry.id, payload);
        updatedCount++;
      } else {
        await base44.asServiceRole.entities.TypeToolMap.create(payload);
        createdCount++;
      }
    }

    return Response.json({
      success: true,
      created: createdCount,
      updated: updatedCount,
      total_types: types.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});