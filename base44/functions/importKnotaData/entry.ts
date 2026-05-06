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

// prefix → domain info 매핑
const DOMAIN_MAP = {
  '1수':   { name: '초등 1학년 수학', grade_range: '1' },
  '2수':   { name: '초등 2학년 수학', grade_range: '2' },
  '3수':   { name: '초등 3학년 수학', grade_range: '3' },
  '4수':   { name: '초등 4학년 수학', grade_range: '4' },
  '5수':   { name: '초등 5학년 수학', grade_range: '5' },
  '6수':   { name: '초등 6학년 수학', grade_range: '6' },
  '7수':   { name: '중학교 1학년 수학', grade_range: '7' },
  '8수':   { name: '중학교 2학년 수학', grade_range: '8' },
  '9수':   { name: '중학교 3학년 수학', grade_range: '9' },
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

// achvmt_std code에서 prefix 추출 (첫 번째 '-' 앞)
function extractPrefix(code) {
  if (!code) return null;
  // 10공수1, 10공수2, 11대수 등 긴 prefix 먼저 체크
  const sorted = Object.keys(DOMAIN_MAP).sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (code.startsWith(prefix)) return prefix;
  }
  // fallback: 첫 dash 앞
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
    const step = body.step || 'all'; // 'check' | 'all'

    // ── STEP 0: fetch all data files ──────────────────────────────────────
    const [toolsText, problemsText, agentAnswersText, usageText, achvmtText] = await Promise.all([
      fetchGithubFile('tools.json'),
      fetchGithubFile('problems.jsonl'),
      fetchGithubFile('agent_answer_records.jsonl'),
      fetchGithubFile('usage_records.jsonl'),
      fetchGithubFile('achvmt_stds.json'),
    ]);

    if (step === 'check') {
      const tools = JSON.parse(toolsText);
      const problems = parseJSONL(problemsText);
      const agents = parseJSONL(agentAnswersText);
      const usages = parseJSONL(usageText);
      const achvmts = JSON.parse(achvmtText);
      return Response.json({
        check: 'ok',
        counts: {
          tools: tools.length,
          problems: problems.length,
          agent_answers: agents.length,
          usage_records: usages.length,
          achvmt_stds: achvmts.length,
        },
        sample_tool: tools[0],
        sample_problem: problems[0],
        sample_usage: usages[0],
      });
    }

    // ── STEP 1: Parse all data ────────────────────────────────────────────
    const tools = JSON.parse(toolsText);
    const problems = parseJSONL(problemsText);
    const agentAnswers = parseJSONL(agentAnswersText);
    const usageRecords = parseJSONL(usageText);

    // Build lookup maps
    const agentMap = new Map(); // problem_id → answer
    for (const a of agentAnswers) {
      if (a.problem_id) agentMap.set(a.problem_id, a.answer || null);
    }

    const usageMap = new Map(); // problem_id → steps[]
    for (const u of usageRecords) {
      if (!u.problem_id) continue;
      if (!usageMap.has(u.problem_id)) usageMap.set(u.problem_id, []);
      usageMap.get(u.problem_id).push(u);
    }

    const toolNameMap = new Map(); // tool_id → name
    const toolAchvmtMap = new Map(); // tool_id → achvmt_std_code
    for (const t of tools) {
      toolNameMap.set(t.id, t.name);
      if (t.achvmt_std_code) toolAchvmtMap.set(t.id, t.achvmt_std_code);
    }

    // ── STEP 2: Clear existing data ───────────────────────────────────────
    const [existingProblems, existingTools, existingDomains] = await Promise.all([
      base44.asServiceRole.entities.Problem.list('-created_date', 9999),
      base44.asServiceRole.entities.MathTool.list('-created_date', 9999),
      base44.asServiceRole.entities.Domain.list('-created_date', 9999),
    ]);

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    // Delete one-by-one with delay
    async function deleteAll(entityName, items) {
      for (let i = 0; i < items.length; i++) {
        await base44.asServiceRole.entities[entityName].delete(items[i].id);
        if ((i + 1) % 5 === 0) await sleep(1000);
      }
    }

    await deleteAll('Problem', existingProblems);
    await deleteAll('MathTool', existingTools);
    await deleteAll('Domain', existingDomains);

    // ── STEP 3: Create Domains ────────────────────────────────────────────
    const domainEntities = [];
    for (const [prefix, info] of Object.entries(DOMAIN_MAP)) {
      const d = await base44.asServiceRole.entities.Domain.create({
        domain_id: prefix,
        name: info.name,
        name_en: null,
        achvmt_prefix_patterns: JSON.stringify([prefix]),
        problem_count: 0,
        grade_range: info.grade_range,
      });
      domainEntities.push(d);
    }
    // domain_id → entity.id map
    const domainIdMap = new Map(); // prefix → DB id
    for (const d of domainEntities) {
      domainIdMap.set(d.domain_id, d.id);
    }

    // ── STEP 4: Create MathTools ──────────────────────────────────────────
    const mathToolEntities = [];
    for (const t of tools) {
      const mt = await base44.asServiceRole.entities.MathTool.create({
        tool_id: t.id,
        name: t.name,
        name_en: null,
        goal: t.goal || null,
        description: [t.precondition, t.operation].filter(Boolean).join('\n\n') || t.operation || null,
        domain_ids: null,
        problem_count: 0,
      });
      mathToolEntities.push(mt);
    }
    // tool_id → entity.id
    const mathToolEntityMap = new Map(); // tool_id → DB id
    for (const mt of mathToolEntities) {
      mathToolEntityMap.set(mt.tool_id, mt.id);
    }

    // ── STEP 5: Create Problems ───────────────────────────────────────────
    const problemToolCount = new Map(); // tool_id → count
    const domainProblemCount = new Map(); // domain_id (prefix) → count

    const createdProblems = [];

    for (let i = 0; i < problems.length; i++) {
      const p = problems[i];
      if (i > 0 && i % 10 === 0) await sleep(1000);

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

      if (prefix) {
        domainProblemCount.set(prefix, (domainProblemCount.get(prefix) || 0) + 1);
      }
      for (const tid of uniqueToolIds) {
        problemToolCount.set(tid, (problemToolCount.get(tid) || 0) + 1);
      }

      const diffs = steps.map(s => s.discover_difficulty).filter(v => v != null);
      const difficulty = diffs.length > 0
        ? Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10
        : null;

      const created = await base44.asServiceRole.entities.Problem.create({
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
      createdProblems.push(created);
    }

    // ── STEP 6: Update MathTool.domain_ids & problem_count ───────────────
    await Promise.all(
      tools.map(t => {
        const achvmtCode = toolAchvmtMap.get(t.id);
        const prefix = achvmtCode ? extractPrefix(achvmtCode) : null;
        const domainIds = prefix ? JSON.stringify([prefix]) : null;
        const count = problemToolCount.get(t.id) || 0;
        const entityId = mathToolEntityMap.get(t.id);
        if (!entityId) return Promise.resolve();
        return base44.asServiceRole.entities.MathTool.update(entityId, {
          domain_ids: domainIds,
          problem_count: count,
        });
      })
    );

    // ── STEP 7: Update Domain.problem_count ───────────────────────────────
    await Promise.all(
      domainEntities.map(d => {
        const count = domainProblemCount.get(d.domain_id) || 0;
        return base44.asServiceRole.entities.Domain.update(d.id, {
          problem_count: count,
        });
      })
    );

    // ── STEP 8: Verification ──────────────────────────────────────────────
    const verifyId = '34b27614-1813-4dae-a97e-a4dbd7988cb9';
    const verifyProblem = createdProblems.find(p => p.problem_id === verifyId);
    let samplePath = null;
    if (verifyProblem?.solution_path) {
      samplePath = JSON.parse(verifyProblem.solution_path);
    }

    return Response.json({
      success: true,
      counts: {
        problems_created: createdProblems.length,
        tools_created: mathToolEntities.length,
        domains_created: domainEntities.length,
      },
      verification: {
        problem_id: verifyId,
        found: !!verifyProblem,
        solution_path_steps: samplePath?.length || 0,
        solution_path: samplePath,
      }
    });

  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});