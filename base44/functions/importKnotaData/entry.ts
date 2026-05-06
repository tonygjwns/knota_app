import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN');
const REPO = 'tonygjwns/knota_app';
const BRANCH = 'main';

async function fetchGithubFile(path) {
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/data/${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `token ${GITHUB_TOKEN}` }
  });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
  return await res.text();
}

function parseJSONL(text) {
  return text.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

const DOMAIN_MAP = {
  '1수':    { name: '초등 1학년 수학', grade_range: '1' },
  '2수':    { name: '초등 2학년 수학', grade_range: '2' },
  '3수':    { name: '초등 3학년 수학', grade_range: '3' },
  '4수':    { name: '초등 4학년 수학', grade_range: '4' },
  '5수':    { name: '초등 5학년 수학', grade_range: '5' },
  '6수':    { name: '초등 6학년 수학', grade_range: '6' },
  '7수':    { name: '중학교 1학년 수학', grade_range: '7' },
  '8수':    { name: '중학교 2학년 수학', grade_range: '8' },
  '9수':    { name: '중학교 3학년 수학', grade_range: '9' },
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode || 'check'; // 'check' | 'init' | 'problems'

    // ── GitHub data ────────────────────────────────────────────────────────
    const [toolsText, problemsText, agentAnswersText, usageText] = await Promise.all([
      fetchGithubFile('tools.json'),
      fetchGithubFile('problems.jsonl'),
      fetchGithubFile('agent_answer_records.jsonl'),
      fetchGithubFile('usage_records.jsonl'),
    ]);

    const tools = JSON.parse(toolsText);
    const problems = parseJSONL(problemsText);
    const agentAnswers = parseJSONL(agentAnswersText);
    const usageRecords = parseJSONL(usageText);

    // ── check mode ────────────────────────────────────────────────────────
    if (mode === 'check') {
      const [dbProblems, dbTools, dbDomains] = await Promise.all([
        base44.asServiceRole.entities.Problem.list('-created_date', 9999),
        base44.asServiceRole.entities.MathTool.list('-created_date', 9999),
        base44.asServiceRole.entities.Domain.list('-created_date', 9999),
      ]);
      return Response.json({
        github: { problems: problems.length, tools: tools.length },
        db: { problems: dbProblems.length, tools: dbTools.length, domains: dbDomains.length },
        remaining_problems: problems.filter(p =>
          !dbProblems.some(dp => dp.problem_id === p.problem_id)
        ).length,
      });
    }

    // ── Build lookup maps (shared by init + problems) ─────────────────────
    const agentMap = new Map();
    for (const a of agentAnswers) {
      if (a.problem_id) agentMap.set(a.problem_id, a.answer || null);
    }

    const usageMap = new Map();
    for (const u of usageRecords) {
      if (!u.problem_id) continue;
      if (!usageMap.has(u.problem_id)) usageMap.set(u.problem_id, []);
      usageMap.get(u.problem_id).push(u);
    }

    const toolNameMap = new Map();
    const toolAchvmtMap = new Map();
    for (const t of tools) {
      toolNameMap.set(t.id, t.name);
      if (t.achvmt_std_code) toolAchvmtMap.set(t.id, t.achvmt_std_code);
    }

    // ── init mode: create Domains + MathTools (skip existing) ────────────
    if (mode === 'init') {
      const [existingDomains, existingTools] = await Promise.all([
        base44.asServiceRole.entities.Domain.list('-created_date', 9999),
        base44.asServiceRole.entities.MathTool.list('-created_date', 9999),
      ]);

      const existingDomainIds = new Set(existingDomains.map(d => d.domain_id));
      const existingToolIds = new Set(existingTools.map(t => t.tool_id));

      // Create missing domains
      const newDomains = Object.entries(DOMAIN_MAP)
        .filter(([prefix]) => !existingDomainIds.has(prefix))
        .map(([prefix, info]) => ({
          domain_id: prefix,
          name: info.name,
          name_en: null,
          achvmt_prefix_patterns: JSON.stringify([prefix]),
          problem_count: 0,
          grade_range: info.grade_range,
        }));

      if (newDomains.length > 0) {
        await base44.asServiceRole.entities.Domain.bulkCreate(newDomains);
      }

      // Create missing tools
      const newTools = tools
        .filter(t => !existingToolIds.has(t.id))
        .map(t => ({
          tool_id: t.id,
          name: t.name,
          name_en: null,
          goal: t.goal || null,
          description: [t.precondition, t.operation].filter(Boolean).join('\n\n') || null,
          domain_ids: null,
          problem_count: 0,
        }));

      if (newTools.length > 0) {
        await base44.asServiceRole.entities.MathTool.bulkCreate(newTools);
      }

      return Response.json({
        success: true,
        mode: 'init',
        domains_created: newDomains.length,
        tools_created: newTools.length,
        domains_skipped: existingDomainIds.size,
        tools_skipped: existingToolIds.size,
      });
    }

    // ── problems mode: insert a chunk of problems ─────────────────────────
    if (mode === 'problems') {
      const offset = body.offset ?? 0;
      const limit = body.limit ?? 50;

      // Load existing problem_ids to skip
      const existingProblems = await base44.asServiceRole.entities.Problem.list('-created_date', 9999);
      const existingProblemIds = new Set(existingProblems.map(p => p.problem_id));

      // Slice the chunk
      const chunk = problems.slice(offset, offset + limit);

      const toInsert = [];
      for (const p of chunk) {
        if (existingProblemIds.has(p.problem_id)) continue;

        const steps = (usageMap.get(p.problem_id) || [])
          .sort((a, b) => (a.sequence_order ?? 0) - (b.sequence_order ?? 0))
          .map(u => ({
            sequence_order: u.sequence_order,
            tool_id: u.tool_id,
            tool_name: toolNameMap.get(u.tool_id) || u.tool_id,
            reason: u.reason || null,
            application: u.application || null,
            appended_info: u.appended_info || null,
            contribution: u.contribution || null,
            discover_difficulty: u.discover_difficulty ?? null,
            compute_difficulty: u.compute_difficulty ?? null,
          }));

        const uniqueToolIds = [...new Set(steps.map(s => s.tool_id).filter(Boolean))];
        const achvmtCodes = [...new Set(
          uniqueToolIds.map(tid => toolAchvmtMap.get(tid)).filter(Boolean)
        )];

        const firstCode = (p.achvmt_std_codes?.[0]) || achvmtCodes[0] || null;
        const prefix = firstCode ? extractPrefix(firstCode) : null;
        const domainName = prefix ? DOMAIN_MAP[prefix]?.name || null : null;

        const diffs = steps.map(s => s.discover_difficulty).filter(v => v != null);
        const difficulty = diffs.length > 0
          ? Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10
          : null;

        toInsert.push({
          problem_id: p.problem_id,
          source: p.source || null,
          content: JSON.stringify(p.content),
          verified_answer: p.verified_answer || null,
          domain_id: prefix,
          domain_name: domainName,
          achvmt_std_codes: JSON.stringify(achvmtCodes),
          tool_ids: JSON.stringify(uniqueToolIds),
          agent_solution: agentMap.get(p.problem_id) || null,
          solution_path: JSON.stringify(steps),
          difficulty: difficulty,
        });
      }

      // bulkCreate in one shot
      let created = 0;
      if (toInsert.length > 0) {
        await base44.asServiceRole.entities.Problem.bulkCreate(toInsert);
        created = toInsert.length;
      }

      const next_offset = offset + limit;
      const total_remaining = problems.length - (existingProblemIds.size + created);

      return Response.json({
        success: true,
        mode: 'problems',
        offset,
        limit,
        chunk_size: chunk.length,
        inserted: created,
        skipped: chunk.length - created,
        total_in_github: problems.length,
        total_in_db_before: existingProblemIds.size,
        total_remaining: Math.max(0, total_remaining),
        next_offset: next_offset < problems.length ? next_offset : null,
      });
    }

    return Response.json({ error: `Unknown mode: ${mode}` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});