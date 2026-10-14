/**
 * Multi-generational campaign attack lineage tree builder.
 * Resolves hierarchical relationships: Round 1 Root -> Round 2 Child -> Round 3 Grandchild.
 * Handles missing parents, multiple children, duplicate references, and cyclic references safely.
 */

export function buildLineageTrees(evaluations = []) {
  if (!Array.isArray(evaluations) || evaluations.length === 0) {
    return { rootNodes: [], orphanedNodes: [] };
  }

  const promptIdToEval = new Map();
  const childrenMap = new Map(); // parentPromptId (string) -> array of evaluations
  const allPromptIds = new Set();

  for (const item of evaluations) {
    if (!item) continue;
    const p = item.promptId;
    const pId = p?._id ? String(p._id) : (p ? String(p) : (item._id ? String(item._id) : null));

    if (pId) {
      allPromptIds.add(pId);
      if (!promptIdToEval.has(pId)) {
        promptIdToEval.set(pId, item);
      }

      const parentId = p?.parentPromptId?._id
        ? String(p.parentPromptId._id)
        : (p?.parentPromptId ? String(p.parentPromptId) : null);

      if (parentId) {
        if (!childrenMap.has(parentId)) {
          childrenMap.set(parentId, []);
        }
        childrenMap.get(parentId).push(item);
      }
    }
  }

  // Recursive tree builder with cycle detection
  const visitedPromptIds = new Set();

  function buildNode(evaluation) {
    const p = evaluation.promptId;
    const pId = p?._id ? String(p._id) : (p ? String(p) : (evaluation._id ? String(evaluation._id) : null));
    if (!pId || visitedPromptIds.has(pId)) {
      return null;
    }
    visitedPromptIds.add(pId);

    const directChildren = childrenMap.get(pId) || [];
    const childrenNodes = [];

    for (const childEval of directChildren) {
      const childNode = buildNode(childEval);
      if (childNode) {
        childrenNodes.push(childNode);
      }
    }

    return {
      evaluation,
      children: childrenNodes
    };
  }

  // 1. Identify primary roots (Round 1 evaluations)
  const rootNodes = [];
  const round1Evals = evaluations.filter(e => {
    const round = e.generationRound || e.promptId?.generationRound || 1;
    return round === 1;
  });

  for (const r1 of round1Evals) {
    const node = buildNode(r1);
    if (node) {
      rootNodes.push(node);
    }
  }

  // 2. Identify any orphaned evaluations (generationRound > 1 whose parent is missing from results)
  const orphanedNodes = [];
  for (const item of evaluations) {
    const p = item.promptId;
    const pId = p?._id ? String(p._id) : (p ? String(p) : (item._id ? String(item._id) : null));
    if (pId && !visitedPromptIds.has(pId)) {
      const parentId = p?.parentPromptId?._id
        ? String(p.parentPromptId._id)
        : (p?.parentPromptId ? String(p.parentPromptId) : null);

      // Orphaned if parent doesn't exist in results or no parent specified
      if (!parentId || !allPromptIds.has(parentId)) {
        const orphanNode = buildNode(item);
        if (orphanNode) {
          orphanedNodes.push(orphanNode);
        }
      }
    }
  }

  return { rootNodes, orphanedNodes };
}
