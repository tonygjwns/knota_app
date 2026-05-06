import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const GITHUB_TOKEN = Deno.env.get('GITHUB_TOKEN');

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

    // Get repo info
    const repoRes = await fetch('https://api.github.com/repos/tonygjwns/knota_app', {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      }
    });
    const repoInfo = await repoRes.json();

    // List all contents including subdirs
    const rootRes = await fetch('https://api.github.com/repos/tonygjwns/knota_app/contents/src', {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      }
    });
    const rootContents = await rootRes.json();

    return Response.json({
      repo_status: repoRes.status,
      default_branch: repoInfo.default_branch,
      private: repoInfo.private,
      root_files: Array.isArray(rootContents) ? rootContents.map(f => f.name) : rootContents,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});