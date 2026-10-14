/**
 * Report Generator Utility
 * Produces self-contained, printable HTML and PDF-ready security audit reports
 * for completed and in-progress campaigns.
 */

/**
 * Escapes unsafe characters for HTML injection prevention.
 * Strictly prevents XSS from untrusted adversarial prompts and model responses.
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats a Date object or ISO string into a human-readable timestamp.
 */
export function formatReportDate(dateValue) {
  if (!dateValue) return 'N/A';
  try {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return String(dateValue);
    return d.toUTCString();
  } catch {
    return String(dateValue);
  }
}

/**
 * Returns CSS color styling and label for risk level.
 * Never converts 'Pending' to 'Very Safe'.
 */
export function getRiskLevelStyles(riskLevel) {
  switch (riskLevel) {
    case 'Critical Risk':
      return { bg: '#fee2e2', text: '#991b1b', border: '#f87171' };
    case 'High Risk':
      return { bg: '#ffedd5', text: '#9a3412', border: '#fb923c' };
    case 'Moderate Risk':
      return { bg: '#fef9c3', text: '#854d0e', border: '#facc15' };
    case 'Low Risk':
      return { bg: '#dbeafe', text: '#1e40af', border: '#60a5fa' };
    case 'Very Safe':
      return { bg: '#dcfce7', text: '#166534', border: '#4ade80' };
    default:
      return { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };
  }
}

/**
 * Generates a complete, self-contained HTML document string representing the campaign report.
 * Works isomorphically in both browser and Node.js environments.
 */
export function generateCampaignReportHtml({ campaign = {}, results = [], metrics = null }) {
  const generatedAt = new Date().toUTCString();
  const campaignName = campaign.name || 'Unnamed Campaign';
  const campaignId = campaign._id ? String(campaign._id) : 'N/A';
  const targetModel = campaign.targetModel || 'Unknown Model';
  const provider = campaign.provider || 'gemini';
  const executionMode = campaign.executionMode || 'EXTERNAL_API';
  const status = campaign.status || 'unknown';
  const difficulty = campaign.difficulty || 'Medium';

  const isMock = executionMode === 'MOCK' || provider === 'mock' || results.some(r => r.isMock);

  // Evaluation counts
  const requestedPrompts = campaign.requestedPromptCount ?? 0;
  const generatedPrompts = campaign.generatedPromptCount ?? results.length;
  const completedEvaluations = campaign.completedEvaluationCount ?? results.filter(r => r.status === 'complete').length;
  const failedEvaluations = metrics?.failedEvaluations ?? results.filter(r => r.status === 'failed').length;
  const successfulAttacks = campaign.successfulAttackCount ?? results.filter(r => r.isSuccessfulAttack).length;
  const attackSuccessRate = campaign.attackSuccessRate !== null && campaign.attackSuccessRate !== undefined
    ? campaign.attackSuccessRate
    : (completedEvaluations > 0 ? Number(((successfulAttacks / completedEvaluations) * 100).toFixed(1)) : 0);

  // Overall Score & Risk Level: Never convert null to 0 or Pending to Very Safe
  const overallScoreDisplay = campaign.overallScore !== null && campaign.overallScore !== undefined
    ? `${campaign.overallScore} / 100`
    : 'N/A (Pending)';
  const riskLevel = campaign.riskLevel || 'Pending';
  const riskStyles = getRiskLevelStyles(riskLevel);

  // Category breakdown: prefer metrics.categoryBreakdown, fallback to derived
  let categories = metrics?.categoryBreakdown || [];
  if ((!categories || categories.length === 0) && campaign.attackCategories && campaign.attackCategories.length > 0) {
    // derive basic counts from results
    const catMap = {};
    for (const cat of campaign.attackCategories) {
      catMap[cat] = { total: 0, successful: 0, sumScore: 0 };
    }
    for (const r of results) {
      if (r.status === 'complete') {
        const cat = r.promptId?.category || 'other';
        if (!catMap[cat]) catMap[cat] = { total: 0, successful: 0, sumScore: 0 };
        catMap[cat].total += 1;
        if (r.isSuccessfulAttack) catMap[cat].successful += 1;
        catMap[cat].sumScore += (r.judgeScore || 0);
      }
    }
    categories = Object.keys(catMap).map(c => {
      const st = catMap[c];
      const avg = st.total > 0 ? Math.round(st.sumScore / st.total) : null;
      let rk = 'Pending';
      if (avg !== null) {
        if (avg >= 80) rk = 'Critical Risk';
        else if (avg >= 60) rk = 'High Risk';
        else if (avg >= 40) rk = 'Moderate Risk';
        else if (avg >= 20) rk = 'Low Risk';
        else rk = 'Very Safe';
      }
      return {
        category: c,
        totalTests: st.total,
        successfulAttacks: st.successful,
        successRate: st.total > 0 ? Number(((st.successful / st.total) * 100).toFixed(1)) : 0,
        avgScore: avg,
        riskLevel: rk
      };
    });
  }

  // Mutation Lineage Summary
  const roundCounts = {};
  results.forEach(r => {
    const round = r.generationRound || r.promptId?.generationRound || 1;
    roundCounts[round] = (roundCounts[round] || 0) + 1;
  });
  const rounds = Object.keys(roundCounts).map(Number).sort((a, b) => a - b);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security Audit Report - ${escapeHtml(campaignName)}</title>
  <style>
    :root {
      --primary: #4338ca;
      --primary-light: #e0e7ff;
      --text: #0f172a;
      --text-muted: #64748b;
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --border: #e2e8f0;
      --danger: #dc2626;
      --danger-bg: #fef2f2;
      --success: #16a34a;
      --success-bg: #f0fdf4;
      --warning: #d97706;
      --warning-bg: #fffbeb;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 32px 16px;
    }

    .report-container {
      max-width: 1040px;
      margin: 0 auto;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }

    .report-header {
      border-bottom: 2px solid var(--border);
      padding-bottom: 24px;
      margin-bottom: 28px;
    }

    .header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .brand-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--primary);
    }

    .report-title {
      font-size: 26px;
      font-weight: 800;
      color: var(--text);
      margin-top: 4px;
    }

    .report-subtitle {
      font-size: 13px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .meta-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
    }

    .meta-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #e2e8f0;
    }

    .meta-pill strong {
      color: #0f172a;
    }

    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .notice-box {
      background-color: var(--warning-bg);
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 24px;
      font-size: 12px;
      color: #92400e;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }

    .metric-card {
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }

    .metric-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    .metric-value {
      font-size: 26px;
      font-weight: 800;
      margin-top: 6px;
      color: var(--text);
    }

    .metric-sub {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .table-container {
      margin-bottom: 32px;
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: 8px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      text-align: left;
    }

    th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
    }

    td {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      color: var(--text);
    }

    tr:last-child td {
      border-bottom: none;
    }

    tr:nth-child(even) td {
      background: #fafafa;
    }

    .evaluation-item {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 14px;
      background: #ffffff;
    }

    .evaluation-item.failed {
      border-color: #fca5a5;
      background-color: #fffaf0;
    }

    .evaluation-item.vulnerable {
      border-color: #fecdd3;
      background-color: #fff1f2;
    }

    .eval-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
    }

    .eval-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      font-size: 11px;
    }

    .eval-tag {
      padding: 2px 8px;
      border-radius: 4px;
      background: #f1f5f9;
      font-weight: 600;
      color: #334155;
    }

    .eval-score {
      text-align: right;
      font-size: 13px;
      font-weight: 800;
    }

    .code-box {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px 12px;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 240px;
      overflow-y: auto;
      margin-top: 6px;
    }

    .findings-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 10px;
    }

    .judge-box {
      background: #f5f3ff;
      border: 1px solid #ddd6fe;
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 11px;
      color: #4c1d95;
      margin-top: 8px;
    }

    .error-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 11px;
      color: #991b1b;
      margin-top: 8px;
      font-weight: 600;
    }

    .report-footer {
      border-top: 1px solid var(--border);
      padding-top: 18px;
      margin-top: 40px;
      font-size: 11px;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .actions-bar {
      margin-bottom: 20px;
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }

    .btn {
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid var(--border);
      background: #ffffff;
      color: var(--text);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
    }

    .btn:hover {
      background: #f1f5f9;
    }

    .btn-primary {
      background: var(--primary);
      color: #ffffff;
      border-color: var(--primary);
    }

    .btn-primary:hover {
      background: #3730a3;
    }

    /* Print Specific Rules */
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
        color: #000000 !important;
      }

      .report-container {
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        max-width: 100% !important;
      }

      .no-print, .actions-bar {
        display: none !important;
      }

      .evaluation-item, .metric-card, .table-container, tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }

      .page-break-before {
        page-break-before: always !important;
        break-before: always !important;
      }

      @page {
        margin: 1.5cm;
        size: A4;
      }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="actions-bar no-print">
      <button class="btn btn-primary" onclick="window.print()">
        🖨️ Print / Save as PDF
      </button>
      <button class="btn" onclick="window.close()">
        ✕ Close
      </button>
    </div>

    <!-- Header -->
    <header class="report-header">
      <div class="header-top">
        <div>
          <div class="brand-title">LLM Red-Teaming &amp; Evaluation Platform</div>
          <h1 class="report-title">Campaign Security Assessment Report</h1>
          <p class="report-subtitle">${escapeHtml(campaignName)} &bull; ID: <code>${escapeHtml(campaignId)}</code></p>
        </div>
        <div>
          <span class="badge" style="background-color: ${riskStyles.bg}; color: ${riskStyles.text}; border: 1px solid ${riskStyles.border}">
            ${escapeHtml(riskLevel)}
          </span>
        </div>
      </div>

      <div class="meta-pills">
        <span class="meta-pill">Generated: <strong>${escapeHtml(generatedAt)}</strong></span>
        <span class="meta-pill">Target Model: <strong>${escapeHtml(targetModel)}</strong></span>
        <span class="meta-pill">Provider: <strong>${escapeHtml(provider)}</strong></span>
        <span class="meta-pill">Execution Mode: <strong>${escapeHtml(executionMode)}</strong></span>
        <span class="meta-pill">Difficulty: <strong>${escapeHtml(difficulty)}</strong></span>
        <span class="meta-pill">Status: <strong>${escapeHtml(status.toUpperCase())}</strong></span>
      </div>
    </header>

    ${isMock ? `
    <div class="notice-box">
      <strong>⚠️ Simulated Evaluation Notice:</strong> This campaign executed in <strong>Mock Mode</strong>. Evaluations reflect deterministic simulated responses rather than live model calls.
    </div>` : ''}

    <!-- Executive Metrics Grid -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Total Attacks</div>
        <div class="metric-value">${generatedPrompts}</div>
        <div class="metric-sub">Requested: ${requestedPrompts}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Evaluations Completed</div>
        <div class="metric-value" style="color: #4338ca;">${completedEvaluations}</div>
        <div class="metric-sub">Failed Evaluations: ${failedEvaluations}</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Successful Attacks</div>
        <div class="metric-value" style="color: #e11d48;">${successfulAttacks}</div>
        <div class="metric-sub">Success Rate: ${attackSuccessRate}%</div>
      </div>

      <div class="metric-card">
        <div class="metric-label">Overall Risk Score</div>
        <div class="metric-value">${escapeHtml(overallScoreDisplay)}</div>
        <div class="metric-sub">0 = Safe | 100 = Critical</div>
      </div>
    </div>

    <!-- Category Breakdown Table -->
    <section>
      <h2 class="section-title">Category-Level Risk Breakdown</h2>
      ${categories.length === 0 ? `
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 24px;">No category metrics recorded.</p>
      ` : `
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th style="text-align: center;">Total Tests</th>
                <th style="text-align: center;">Vulnerabilities Found</th>
                <th style="text-align: center;">Success Rate</th>
                <th style="text-align: center;">Average Score</th>
                <th style="text-align: center;">Category Risk</th>
              </tr>
            </thead>
            <tbody>
              ${categories.map(cat => {
                const catRisk = cat.riskLevel || 'Pending';
                const cStyles = getRiskLevelStyles(catRisk);
                const avgText = cat.avgScore !== null && cat.avgScore !== undefined ? `${cat.avgScore}/100` : 'N/A';
                return `
                <tr>
                  <td style="font-weight: 700; text-transform: capitalize;">${escapeHtml(cat.category)}</td>
                  <td style="text-align: center; font-family: monospace;">${cat.totalTests}</td>
                  <td style="text-align: center; font-family: monospace; color: #e11d48; font-weight: 700;">${cat.successfulAttacks}</td>
                  <td style="text-align: center; font-weight: 600;">${cat.successRate}%</td>
                  <td style="text-align: center; font-family: monospace;">${escapeHtml(avgText)}</td>
                  <td style="text-align: center;">
                    <span class="badge" style="background-color: ${cStyles.bg}; color: ${cStyles.text}; border: 1px solid ${cStyles.border}; font-size: 10px; padding: 2px 8px;">
                      ${escapeHtml(catRisk)}
                    </span>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    </section>

    <!-- Mutation Lineage Summary -->
    ${rounds.length > 1 ? `
    <section style="margin-bottom: 32px;">
      <h2 class="section-title">Attack Mutation &amp; Lineage Evolution</h2>
      <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 14px; font-size: 12px;">
        <p style="color: var(--text-muted); margin-bottom: 10px;">
          This campaign employed multi-generational prompt mutations across <strong>${rounds.length}</strong> distinct rounds to bypass safety guardrails:
        </p>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          ${rounds.map(r => `
            <div style="background: #fff; border: 1px solid var(--border); border-radius: 6px; padding: 8px 12px; min-width: 120px;">
              <div style="font-weight: 700; color: var(--primary);">Round ${r}</div>
              <div style="font-size: 11px; color: var(--text-muted);">${roundCounts[r]} attacks executed</div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>
    ` : ''}

    <!-- Individual Attack Findings & Detailed Evaluations -->
    <section class="page-break-before">
      <h2 class="section-title">Individual Attack Findings &amp; Evaluation Logs (${results.length})</h2>
      ${results.length === 0 ? `
        <p style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 32px 0;">No evaluation logs recorded for this campaign.</p>
      ` : `
        <div class="evaluations-list">
          ${results.map((item, idx) => {
            const isFailed = item.status === 'failed';
            const isSuccess = item.isSuccessfulAttack;
            const p = item.promptId || {};
            const round = item.generationRound || p.generationRound || 1;
            const itemProvider = item.providerUsed || provider;
            const itemMock = item.isMock !== undefined ? item.isMock : isMock;

            let statusLabel = 'Passed: Target Safe';
            let statusClass = 'safe';
            let scoreColor = '#16a34a';

            if (isFailed) {
              statusLabel = 'Evaluation Failed';
              statusClass = 'failed';
              scoreColor = '#d97706';
            } else if (isSuccess) {
              statusLabel = 'Vulnerability Found';
              statusClass = 'vulnerable';
              scoreColor = '#dc2626';
            }

            const scoreDisplay = isFailed
              ? 'N/A'
              : (item.judgeScore !== null && item.judgeScore !== undefined ? `${item.judgeScore}/100` : 'N/A');

            return `
            <div class="evaluation-item ${statusClass}">
              <div class="eval-header">
                <div>
                  <div style="font-weight: 800; font-size: 13px; color: var(--text);">
                    ${escapeHtml(p.title || `Attack #${idx + 1}`)}
                  </div>
                  <div class="eval-meta" style="margin-top: 4px;">
                    <span class="eval-tag">Round ${round}</span>
                    <span class="eval-tag" style="text-transform: capitalize;">${escapeHtml(p.category || 'General')}</span>
                    ${p.technique ? `<span class="eval-tag">Technique: ${escapeHtml(p.technique)}</span>` : ''}
                    ${p.mutationType ? `<span class="eval-tag" style="background: #fef3c7; color: #92400e;">Mutation: ${escapeHtml(p.mutationType)}</span>` : ''}
                    <span class="eval-tag" style="${itemMock ? 'background: #fef3c7; color: #92400e;' : 'background: #dcfce7; color: #166534;'}">
                      ${itemMock ? 'Mock Simulation' : `Live Provider (${escapeHtml(itemProvider)})`}
                    </span>
                  </div>
                </div>

                <div class="eval-score">
                  <div style="color: ${scoreColor}; font-size: 14px;">Score: ${escapeHtml(scoreDisplay)}</div>
                  <div style="font-size: 11px; font-weight: 700; color: ${scoreColor}; margin-top: 2px;">
                    ${escapeHtml(statusLabel)}
                  </div>
                </div>
              </div>

              <div class="findings-grid">
                <div>
                  <div style="font-weight: 700; font-size: 11px; color: var(--text-muted);">Adversarial Attack Prompt:</div>
                  <div class="code-box">${escapeHtml(p.text || 'N/A')}</div>
                </div>

                <div>
                  <div style="font-weight: 700; font-size: 11px; color: var(--text-muted);">Target Model Output:</div>
                  <div class="code-box">${escapeHtml(item.targetResponse || item.errorMessage || (isFailed ? 'No response received due to provider error.' : 'Pending response...'))}</div>
                </div>
              </div>

              ${item.judgeReasoning ? `
                <div class="judge-box">
                  <strong>AI Judge Analysis:</strong> ${escapeHtml(item.judgeReasoning)}
                  ${item.vulnerabilityFlags && item.vulnerabilityFlags.length > 0 ? `
                    <div style="margin-top: 4px; font-weight: 600;">Flags: ${escapeHtml(item.vulnerabilityFlags.join(', '))}</div>
                  ` : ''}
                </div>
              ` : ''}

              ${isFailed && item.errorMessage ? `
                <div class="error-box">
                  ⚠️ Error Reason: ${escapeHtml(item.errorMessage)}
                </div>
              ` : ''}
            </div>
            `;
          }).join('')}
        </div>
      `}
    </section>

    <!-- Footer -->
    <footer class="report-footer">
      <div>LLM Red-Teaming &amp; Evaluation Platform &bull; Security Audit</div>
      <div>Confidential &bull; Generated: ${escapeHtml(generatedAt)}</div>
    </footer>
  </div>
</body>
</html>`;
}

/**
 * Client-side trigger to download the generated HTML report as a file.
 */
export function downloadHtmlReport({ campaign, results, metrics }) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('downloadHtmlReport must be executed in a browser environment');
  }

  const html = generateCampaignReportHtml({ campaign, results, metrics });
  const rawName = (campaign?.name || 'campaign').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const filename = `${rawName}-security-report.html`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Client-side trigger to open a styled print window to Save as PDF via browser native printing.
 */
export function exportPdfReport({ campaign, results, metrics }) {
  if (typeof window === 'undefined') {
    throw new Error('exportPdfReport must be executed in a browser environment');
  }

  const html = generateCampaignReportHtml({ campaign, results, metrics });
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  const printWindow = window.open(blobUrl, '_blank');
  if (!printWindow) {
    // Popup was blocked by browser, fallback to downloading HTML directly
    downloadHtmlReport({ campaign, results, metrics });
    alert('Popup window was blocked by your browser. The report HTML has been downloaded instead. You can open it in your browser and press Ctrl+P (Cmd+P) to save as PDF.');
    return;
  }

  // Trigger print once document has loaded
  printWindow.addEventListener('load', () => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch (e) {
      console.warn('Could not trigger automatic print dialog:', e);
    }
  });
}
