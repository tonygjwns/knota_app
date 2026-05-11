import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN');
const REPO = 'tonygjwns/knota_app';
const BRANCH = 'main';

async function fetchGithubFile(path) {
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/data/sprint2/${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
  return await res.text();
}

function parseJSONL(text) {
  return text.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

// Same DOMAIN_MAP as importKnotaData
const DOMAIN_MAP = {
  '1수':     { name: '초등 1학년 수학', grade_range: '1' },
  '2수':     { name: '초등 2학년 수학', grade_range: '2' },
  '3수':     { name: '초등 3학년 수학', grade_range: '3' },
  '4수':     { name: '초등 4학년 수학', grade_range: '4' },
  '5수':     { name: '초등 5학년 수학', grade_range: '5' },
  '6수':     { name: '초등 6학년 수학', grade_range: '6' },
  '7수':     { name: '중학교 1학년 수학', grade_range: '7' },
  '8수':     { name: '중학교 2학년 수학', grade_range: '8' },
  '9수':     { name: '중학교 3학년 수학', grade_range: '9' },
  '10공수1': { name: '고등 공통수학1', grade_range: '10' },
  '10공수2': { name: '고등 공통수학2', grade_range: '10' },
  '11대수':  { name: '고등 대수', grade_range: '11' },
  '11미적I': { name: '고등 미적분I', grade_range: '11' },
  '11확통':  { name: '고등 확률과 통계', grade_range: '11' },
  '12미적II': { name: '고등 미적분II', grade_range: '12' },
  '12기하':  { name: '고등 기하', grade_range: '12' },
  '12경수':  { name: '고등 경제수학', grade_range: '12' },
  '12실통':  { name: '고등 실용 통계', grade_range: '12' },
  '12직수':  { name: '고등 직무 수학', grade_range: '12' },
};

function extractPrefix(code) {
  if (!code) return null;
  const sorted = Object.keys(DOMAIN_MAP).sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (code.startsWith(prefix)) return prefix;
  }
  const idx = code.indexOf('-');
  return idx > 0 ? code.slice(0, idx) : code;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Deletes up to batchSize rows from one entity, returns count deleted
async function deleteBatch(db, entityName, batchSize = 30) {
  const rows = await db.entities[entityName].list('-created_date', batchSize);
  if (!rows || rows.length === 0) return 0;
  for (const r of rows) {
    await db.entities[entityName].delete(r.id);
    await sleep(60);
  }
  return rows.length;
}

async function bulkCreateChunked(db, entityName, records, chunkSize = 100) {
  let created = 0;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    await db.entities[entityName].bulkCreate(chunk);
    created += chunk.length;
  }
  return created;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const db = base44.asServiceRole;
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'check';

    // ── check mode ──────────────────────────────────────────────────────────
    if (mode === 'check') {
      const [toolsText, problemsText, solutionsText, knotsText] = await Promise.all([
        fetchGithubFile('tools.json'),
        fetchGithubFile('problems.json'),
        fetchGithubFile('solutions.json'),
        fetchGithubFile('knots.jsonl'),
      ]);

      const tools = JSON.parse(toolsText);
      const problems = JSON.parse(problemsText);
      const solutions = JSON.parse(solutionsText);
      const knots = parseJSONL(knotsText);

      const [dbProblems, dbSolutions, dbSteps, dbTools, dbDomains] = await Promise.all([
        db.entities.Problem.list('-created_date', 9999),
        db.entities.Solution.list('-created_date', 9999),
        db.entities.SolutionStep.list('-created_date', 9999),
        db.entities.MathTool.list('-created_date', 9999),
        db.entities.Domain.list('-created_date', 9999),
      ]);

      return Response.json({
        github: {
          problems: problems.length,
          solutions: solutions.length,
          knots: knots.length,
          tools: tools.length,
        },
        db: {
          problems: dbProblems.length,
          solutions: dbSolutions.length,
          solution_steps: dbSteps.length,
          tools: dbTools.length,
          domains: dbDomains.length,
        },
      });
    }

    // ── reset mode ──────────────────────────────────────────────────────────
    // Call repeatedly until all entities report 0 remaining.
    if (mode === 'reset') {
      const ENTITIES_TO_CLEAR = [
        'Problem', 'Solution', 'SolutionStep', 'MathTool', 'Domain',
        'StudentAttempt', 'BookmarkedProblem', 'BookmarkedTool', 'Assignment',
      ];

      const deleted = {};
      const remaining = {};
      for (const name of ENTITIES_TO_CLEAR) {
        deleted[name] = await deleteBatch(db, name, 50);
        // Check remaining count
        const leftover = await db.entities[name].list('-created_date', 1);
        remaining[name] = leftover.length > 0 ? '>' : 0;
      }

      const allDone = Object.values(remaining).every(v => v === 0);

      return Response.json({
        success: true,
        mode: 'reset',
        warning: allDone
          ? '⚠️ 운영 데이터가 전면 삭제되었습니다. 되돌릴 수 없습니다.'
          : '⏳ 삭제 진행 중. 모두 완료될 때까지 reset을 다시 호출하세요.',
        all_done: allDone,
        deleted_this_call: deleted,
        remaining,
      });
    }

    // ── Load GitHub data (shared by init + problems + all) ──────────────────
    const [toolsText, problemsText, solutionsText, knotsText] = await Promise.all([
      fetchGithubFile('tools.json'),
      fetchGithubFile('problems.json'),
      fetchGithubFile('solutions.json'),
      fetchGithubFile('knots.jsonl'),
    ]);

    const tools = JSON.parse(toolsText);
    const problems = JSON.parse(problemsText);
    const solutions = JSON.parse(solutionsText);
    const knots = parseJSONL(knotsText);

    // ── init mode ───────────────────────────────────────────────────────────
    if (mode === 'init') {
      const [existingDomains, existingTools] = await Promise.all([
        db.entities.Domain.list('-created_date', 9999),
        db.entities.MathTool.list('-created_date', 9999),
      ]);

      const existingDomainIds = new Set(existingDomains.map(d => d.domain_id));
      const existingToolIds = new Set(existingTools.map(t => t.tool_id));

      // Collect unique prefixes from tool achvmt codes
      const uniquePrefixes = new Set();
      for (const t of tools) {
        const prefix = extractPrefix(t.achvmt_std_code);
        if (prefix && DOMAIN_MAP[prefix]) uniquePrefixes.add(prefix);
      }

      // Create missing domains
      const newDomains = [...uniquePrefixes]
        .filter(prefix => !existingDomainIds.has(prefix))
        .map(prefix => ({
          domain_id: prefix,
          name: DOMAIN_MAP[prefix].name,
          name_en: null,
          achvmt_prefix_patterns: JSON.stringify([prefix]),
          problem_count: 0,
          grade_range: DOMAIN_MAP[prefix].grade_range,
        }));

      if (newDomains.length > 0) {
        await db.entities.Domain.bulkCreate(newDomains);
      }

      // Create missing tools
      const newTools = tools
        .filter(t => !existingToolIds.has(t.id))
        .map(t => {
          const prefix = extractPrefix(t.achvmt_std_code);
          return {
            tool_id: t.id,
            name: t.name,
            name_en: null,
            goal: t.goal || null,
            description: [t.precondition, t.operation].filter(Boolean).join('\n\n') || null,
            domain_ids: prefix ? JSON.stringify([prefix]) : null,
            problem_count: 0,
          };
        });

      if (newTools.length > 0) {
        await bulkCreateChunked(db, 'MathTool', newTools);
      }

      return Response.json({
        success: true,
        mode: 'init',
        domains_created: newDomains.length,
        domains_skipped: existingDomainIds.size,
        tools_created: newTools.length,
        tools_skipped: existingToolIds.size,
      });
    }

    // ── problems mode ────────────────────────────────────────────────────────
    if (mode === 'problems') {
      // Build lookup maps
      const toolAchvmtMap = new Map();
      for (const t of tools) {
        if (t.achvmt_std_code) toolAchvmtMap.set(t.id, t.achvmt_std_code);
      }

      // solutionsByProblem: problem.id → [solutions]
      const solutionsByProblem = new Map();
      for (const s of solutions) {
        if (!solutionsByProblem.has(s.problem_id)) solutionsByProblem.set(s.problem_id, []);
        solutionsByProblem.get(s.problem_id).push(s);
      }

      // knotsBySolution: solution_id → [knots]
      const knotsBySolution = new Map();
      for (const k of knots) {
        if (!knotsBySolution.has(k.solution_id)) knotsBySolution.set(k.solution_id, []);
        knotsBySolution.get(k.solution_id).push(k);
      }

      // ── Create Problems ──
      const problemRecords = problems.map(p => {
        const pSolutions = solutionsByProblem.get(p.id) || [];
        const allKnots = pSolutions.flatMap(s => knotsBySolution.get(s.id) || []);

        // Unique tool_ids across all knots
        const toolIdsOrdered = [];
        const seenTools = new Set();
        for (const k of allKnots) {
          if (k.tool_id && !seenTools.has(k.tool_id)) {
            seenTools.add(k.tool_id);
            toolIdsOrdered.push(k.tool_id);
          }
        }

        // achvmt codes from tools
        const achvmtSet = new Set();
        for (const tid of toolIdsOrdered) {
          const code = toolAchvmtMap.get(tid);
          if (code) achvmtSet.add(code);
        }

        // Domain: most frequent prefix among knot tools
        const prefixCount = new Map();
        for (const tid of toolIdsOrdered) {
          const code = toolAchvmtMap.get(tid);
          const prefix = extractPrefix(code);
          if (prefix) prefixCount.set(prefix, (prefixCount.get(prefix) || 0) + 1);
        }
        let domainId = null;
        if (prefixCount.size > 0) {
          domainId = [...prefixCount.entries()].sort((a, b) => b[1] - a[1])[0][0];
        }
        const domainName = domainId ? (DOMAIN_MAP[domainId]?.name || null) : null;

        // difficulty: avg discover_difficulty of all knots
        const diffs = allKnots.map(k => k.discover_difficulty).filter(v => v != null);
        const difficulty = diffs.length > 0
          ? Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10
          : null;

        return {
          problem_id: p.id,
          source: p.source || null,
          content: JSON.stringify(p.contents),
          verified_answer: p.answer || null,
          domain_id: domainId,
          domain_name: domainName,
          achvmt_std_codes: JSON.stringify([...achvmtSet]),
          tool_ids: JSON.stringify(toolIdsOrdered),
          difficulty,
        };
      });

      // ── Create Solutions ──
      // Sort per problem_id by created_at asc, assign priority
      const solutionRecords = [];
      for (const [, pSolutions] of solutionsByProblem) {
        const sorted = [...pSolutions].sort((a, b) =>
          new Date(a.created_at) - new Date(b.created_at)
        );
        sorted.forEach((s, idx) => {
          solutionRecords.push({
            solution_id: s.id,
            problem_id: s.problem_id,
            contents: JSON.stringify(s.contents),
            priority: idx + 1,
          });
        });
      }

      // ── Create SolutionSteps ──
      const stepRecords = knots.map(k => ({
        solution_id: k.solution_id,
        tool_id: k.tool_id,
        sequence_order: k.sequence_order,
        reason: k.reason || null,
        application: k.application || null,
        appended_info: k.appended_info || null,
        contribution: k.contribution ?? null,
        discover_difficulty: k.discover_difficulty ?? null,
        compute_difficulty: k.compute_difficulty ?? null,
      }));

      // Bulk create all three in sequence (dependency order)
      const problemsCreated = await bulkCreateChunked(db, 'Problem', problemRecords);
      const solutionsCreated = await bulkCreateChunked(db, 'Solution', solutionRecords);
      const stepsCreated = await bulkCreateChunked(db, 'SolutionStep', stepRecords);

      return Response.json({
        success: true,
        mode: 'problems',
        problems_created: problemsCreated,
        solutions_created: solutionsCreated,
        solution_steps_created: stepsCreated,
      });
    }

    // ── all mode: init + problems (run AFTER reset completes) ────────────────
    if (mode === 'all') {
      // 2. init — domains + tools
      const toolAchvmtMap = new Map();
      for (const t of tools) {
        if (t.achvmt_std_code) toolAchvmtMap.set(t.id, t.achvmt_std_code);
      }

      const uniquePrefixes = new Set();
      for (const t of tools) {
        const prefix = extractPrefix(t.achvmt_std_code);
        if (prefix && DOMAIN_MAP[prefix]) uniquePrefixes.add(prefix);
      }

      const newDomains = [...uniquePrefixes].map(prefix => ({
        domain_id: prefix,
        name: DOMAIN_MAP[prefix].name,
        name_en: null,
        achvmt_prefix_patterns: JSON.stringify([prefix]),
        problem_count: 0,
        grade_range: DOMAIN_MAP[prefix].grade_range,
      }));
      if (newDomains.length > 0) await db.entities.Domain.bulkCreate(newDomains);

      const newTools = tools.map(t => {
        const prefix = extractPrefix(t.achvmt_std_code);
        return {
          tool_id: t.id,
          name: t.name,
          name_en: null,
          goal: t.goal || null,
          description: [t.precondition, t.operation].filter(Boolean).join('\n\n') || null,
          domain_ids: prefix ? JSON.stringify([prefix]) : null,
          problem_count: 0,
        };
      });
      await bulkCreateChunked(db, 'MathTool', newTools);

      // 3. problems — reuse same logic
      const solutionsByProblem = new Map();
      for (const s of solutions) {
        if (!solutionsByProblem.has(s.problem_id)) solutionsByProblem.set(s.problem_id, []);
        solutionsByProblem.get(s.problem_id).push(s);
      }

      const knotsBySolution = new Map();
      for (const k of knots) {
        if (!knotsBySolution.has(k.solution_id)) knotsBySolution.set(k.solution_id, []);
        knotsBySolution.get(k.solution_id).push(k);
      }

      const problemRecords = problems.map(p => {
        const pSolutions = solutionsByProblem.get(p.id) || [];
        const allKnots = pSolutions.flatMap(s => knotsBySolution.get(s.id) || []);

        const toolIdsOrdered = [];
        const seenTools = new Set();
        for (const k of allKnots) {
          if (k.tool_id && !seenTools.has(k.tool_id)) {
            seenTools.add(k.tool_id);
            toolIdsOrdered.push(k.tool_id);
          }
        }

        const achvmtSet = new Set();
        for (const tid of toolIdsOrdered) {
          const code = toolAchvmtMap.get(tid);
          if (code) achvmtSet.add(code);
        }

        const prefixCount = new Map();
        for (const tid of toolIdsOrdered) {
          const code = toolAchvmtMap.get(tid);
          const prefix = extractPrefix(code);
          if (prefix) prefixCount.set(prefix, (prefixCount.get(prefix) || 0) + 1);
        }
        let domainId = null;
        if (prefixCount.size > 0) {
          domainId = [...prefixCount.entries()].sort((a, b) => b[1] - a[1])[0][0];
        }

        const diffs = allKnots.map(k => k.discover_difficulty).filter(v => v != null);
        const difficulty = diffs.length > 0
          ? Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10
          : null;

        return {
          problem_id: p.id,
          source: p.source || null,
          content: JSON.stringify(p.contents),
          verified_answer: p.answer || null,
          domain_id: domainId,
          domain_name: domainId ? (DOMAIN_MAP[domainId]?.name || null) : null,
          achvmt_std_codes: JSON.stringify([...achvmtSet]),
          tool_ids: JSON.stringify(toolIdsOrdered),
          difficulty,
        };
      });

      const solutionRecords = [];
      for (const [, pSolutions] of solutionsByProblem) {
        const sorted = [...pSolutions].sort((a, b) =>
          new Date(a.created_at) - new Date(b.created_at)
        );
        sorted.forEach((s, idx) => {
          solutionRecords.push({
            solution_id: s.id,
            problem_id: s.problem_id,
            contents: JSON.stringify(s.contents),
            priority: idx + 1,
          });
        });
      }

      const stepRecords = knots.map(k => ({
        solution_id: k.solution_id,
        tool_id: k.tool_id,
        sequence_order: k.sequence_order,
        reason: k.reason || null,
        application: k.application || null,
        appended_info: k.appended_info || null,
        contribution: k.contribution ?? null,
        discover_difficulty: k.discover_difficulty ?? null,
        compute_difficulty: k.compute_difficulty ?? null,
      }));

      const problemsCreated = await bulkCreateChunked(db, 'Problem', problemRecords);
      const solutionsCreated = await bulkCreateChunked(db, 'Solution', solutionRecords);
      const stepsCreated = await bulkCreateChunked(db, 'SolutionStep', stepRecords);

      return Response.json({
        success: true,
        mode: 'all',
        note: 'reset은 별도로 먼저 완료해야 합니다 (mode=reset 반복 호출).',
        init: { domains_created: newDomains.length, tools_created: newTools.length },
        problems: {
          problems_created: problemsCreated,
          solutions_created: solutionsCreated,
          solution_steps_created: stepsCreated,
        },
      });
    }

    return Response.json({ error: `Unknown mode: ${mode}` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});