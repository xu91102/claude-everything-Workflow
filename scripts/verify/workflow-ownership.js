"use strict";

const commonmark = require("commonmark");
const {
  allowedFixtures,
  rejectedFixtures,
  repositoryScopeFixture,
} = require("./workflow-ownership-fixtures");

const markdownReader = new commonmark.Parser();
const HIDDEN_HTML_TAGS = new Set(["code", "pre", "script", "style", "template"]);
const ENGLISH_DELIVERY_ACTION =
  "(?:publish(?:es|ed|ing)?|deploy(?:s|ed|ing)?|" +
  "commit(?:s|ted|ting)?|merge(?:s|d|ing)?)";
const LOCAL_WORKFLOW_DIRECTIVE_PATTERNS = [
  // Match ordered actions, not neutral statements that names are displayed in order.
  new RegExp(
    "(?:按顺序|依次|依序|先|随后|然后|接着|最后).{0,12}" +
      "(?:执行|完成|处理|遵循|遵照|发布|部署|提交|合并)",
  ),
  // Match local instructions that point back to a referenced workflow group.
  /(?:执行|完成|遵循|遵照|按照|依照).{0,8}(?:上述|以上|前述|这些)(?:流程|步骤|门禁)?/,
  new RegExp(
    "(?:按|按照|依照|遵循|遵照)?" +
      "(?:上述|以上|前述|这些)(?:流程|步骤|门禁).{0,8}" +
      "(?:必须|需要|应当|应)?" +
      "(?:执行|完成|遵循|遵照|操作|处理|落实|发布|部署|提交|合并)",
  ),
  // Automatic delivery actions are local procedure even without an explicit step reference.
  /(?:自动|自行).{0,8}(?:发布|部署|提交|合并)/,
  /\b(?:execute|complete|follow)(?:\s+\w+){0,3}\s+in order\b/,
  /\b(?:execute|complete|follow)(?:\s+\w+){0,4}\s+(?:above|these|previous|following)\s+(?:steps|workflow|gates)\b/,
  /\b(?:execute|complete|follow)(?:\s+the)?\s+(?:steps|workflow|gates)\s+(?:above|previous|below)\b/,
  new RegExp(
    "\\b(?:above|these|previous|following)\\s+(?:steps|workflow|gates)" +
      "(?:\\s+\\w+){0,4}\\s+" +
      "(?:execute|executed|complete|completed|follow|followed|" +
      "publish|published|deploy|deployed|commit|merge)\\b",
  ),
  new RegExp(
    "\\b(?:steps|workflow|gates)\\s+(?:above|previous|below)" +
      "(?:\\s+\\w+){0,4}\\s+(?:executed|completed|followed|" +
      `${ENGLISH_DELIVERY_ACTION})\\b`,
  ),
  /\b(?:then|next|afterwards|finally)\s+(?:execute|complete|follow|publish|deploy|commit|merge)\b/,
  new RegExp(
    `\\b(?:automatically|auto)[-\\s]+(?:be\\s+)?${ENGLISH_DELIVERY_ACTION}\\b`,
  ),
  new RegExp(`\\b${ENGLISH_DELIVERY_ACTION}\\s+automatically\\b`),
];

const WORKFLOW_DEFINITIONS = [
  {
    file: "rules/01-base.md",
    label: "delivery Gate state machine",
    authorityPath: "skills/using-superpowers/SKILL.md",
    headings: ["开发流程", "最小闭环", "关键未知", "完整流程"],
    signatureTokens: [
      "Clarification Gate",
      "User Review Gate",
      "Ticket Gate",
      "Red Test Gate",
      "Task Review Gate",
      "Verify Gate",
      "PR Gate",
    ],
    tokenAuthorityPaths: {
      "Clarification Gate": ["skills/grilling/SKILL.md"],
      "User Review Gate": ["skills/spec-gate/SKILL.md"],
      "Ticket Gate": ["skills/to-tickets/SKILL.md"],
      "Red Test Gate": ["skills/test-driven-development/SKILL.md"],
      "Task Review Gate": ["skills/code-review/SKILL.md"],
      "Verify Gate": ["commands/verify.md"],
      "PR Gate": ["commands/pr.md"],
    },
    minimumSignatureMatches: 3,
  },
  {
    file: "rules/common/testing.md",
    label: "TDD state machine",
    authorityPath: "skills/test-driven-development/SKILL.md",
    headings: ["TDD 工作流"],
    signatureTokens: [
      "理解需求 -> 编写测试",
      "运行测试 -> 确认失败",
      "实现功能 -> 最小化实现",
      "运行测试 -> 确认通过",
      "重构代码 -> 保持测试通过",
    ],
    detectionTokens: [
      "理解需求",
      "编写测试",
      "运行测试",
      "确认失败",
      "实现功能",
      "最小化实现",
      "确认通过",
      "重构代码",
      "保持测试通过",
    ],
    detectionMinimumMatches: 7,
    minimumSignatureMatches: 3,
  },
  {
    file: "rules/common/agent-orchestration.md",
    label: "ticket and SDD execution procedure",
    authorityPath: "skills/subagent-driven-development/SKILL.md",
    headings: ["Tickets 先于跨会话执行"],
    signatureTokens: [
      "vertical slices",
      "blocking edges",
      "frontier ticket",
      "fresh subagent",
      "controller-owned integration worktree",
      "联合验证后再 resolve",
    ],
    tokenAuthorityPaths: {
      "vertical slices": ["skills/to-tickets/SKILL.md"],
      "blocking edges": ["skills/to-tickets/SKILL.md"],
      "frontier ticket": ["skills/to-tickets/SKILL.md"],
    },
    minimumSignatureMatches: 3,
  },
];

function htmlTagAt(value, start) {
  if (value[start] !== "<") return null;
  let cursor = start + 1;
  let closing = false;
  if (value[cursor] === "/") {
    closing = true;
    cursor += 1;
  }

  // HTML names start with ASCII letters; this excludes visible comparisons such as "a < b".
  const nameMatch = value.slice(cursor).match(/^[A-Za-z][A-Za-z0-9:-]*/);
  if (!nameMatch) return null;
  const name = nameMatch[0].toLowerCase();
  cursor += nameMatch[0].length;

  let quote = "";
  for (; cursor < value.length; cursor += 1) {
    const character = value[cursor];
    if (quote && character === quote) {
      quote = "";
    } else if (!quote && (character === '"' || character === "'")) {
      quote = character;
    } else if (!quote && character === ">") {
      return { closing, end: cursor, name };
    }
  }
  return null;
}

function updateHiddenTagStack(stack, tag) {
  const current = stack[stack.length - 1];
  if (tag.closing) {
    if (tag.name === current) stack.pop();
    return;
  }
  if (
    HIDDEN_HTML_TAGS.has(tag.name) &&
    (stack.length === 0 || current === "template")
  ) {
    stack.push(tag.name);
  }
}

function nodeText(node, includeLinkDestinations = true) {
  let output = "";
  const hiddenTags = [];
  for (let child = node.firstChild; child; child = child.next) {
    if (child.type === "html_inline") {
      const tag = htmlTagAt(child.literal, 0);
      if (tag) updateHiddenTagStack(hiddenTags, tag);
      continue;
    }
    if (hiddenTags.length > 0) continue;
    if (child.type === "text" || child.type === "code") {
      output += child.literal;
    } else if (child.type === "softbreak" || child.type === "linebreak") {
      output += " ";
    } else if (child.type === "link") {
      output += nodeText(child, includeLinkDestinations);
      if (includeLinkDestinations) output += ` ${child.destination || ""}`;
    } else if (!child.type.startsWith("html") && child.type !== "code_block") {
      output += nodeText(child, includeLinkDestinations);
    }
  }
  return output;
}

function ancestorLists(node) {
  let ancestor = node.parent;
  const lists = [];
  while (ancestor) {
    if (ancestor.type === "list") lists.push(ancestor);
    ancestor = ancestor.parent;
  }
  return lists;
}

function listReferenceContext(list) {
  for (let previous = list?.prev; previous; previous = previous.prev) {
    let content = "";
    if (previous.type === "paragraph") content = nodeText(previous);
    if (previous.type === "html_block") {
      content = visibleHtmlText(previous.literal);
    }
    if (content.trim()) {
      const [[startLine], [endLine]] = previous.sourcepos;
      return { content, endLine, startLine };
    }
    if (!["paragraph", "html_block"].includes(previous.type)) return null;
  }
  return null;
}

function stripHtmlTags(value) {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const tag = htmlTagAt(value, index);
    if (tag) {
      output += " ";
      index = tag.end;
    } else {
      output += value[index];
    }
  }
  return output;
}

function visibleHtmlSource(value) {
  let output = "";
  const hiddenTags = [];
  for (let index = 0; index < value.length; index += 1) {
    if (value.startsWith("<!--", index)) {
      const commentEnd = value.indexOf("-->", index + 4);
      index = commentEnd < 0 ? value.length : commentEnd + 2;
      continue;
    }

    const tag = htmlTagAt(value, index);
    if (tag) {
      const wasVisible = hiddenTags.length === 0;
      updateHiddenTagStack(hiddenTags, tag);
      if (wasVisible && hiddenTags.length === 0) {
        output += value.slice(index, tag.end + 1);
      }
      index = tag.end;
    } else if (hiddenTags.length === 0) {
      output += value[index];
    }
  }
  return output;
}

function decodeHtmlEntities(value) {
  // Numeric HTML references may omit semicolons; CommonMark decodes their terminated form.
  const numericDecoded = value.replace(
    /&#(?:[xX][0-9A-Fa-f]+|\d+);?/g,
    (entity) =>
      nodeText(
        markdownReader.parse(entity.endsWith(";") ? entity : `${entity};`),
        false,
      ),
  );
  // Named references require semicolons here, matching CommonMark's strict entity grammar.
  return numericDecoded.replace(/&[A-Za-z][A-Za-z0-9]+;/g, (entity) =>
    nodeText(markdownReader.parse(entity), false),
  );
}

function visibleHtmlText(value) {
  return decodeHtmlEntities(stripHtmlTags(visibleHtmlSource(value)));
}

function inlineHtmlSource(node) {
  let output = "";
  for (let child = node.firstChild; child; child = child.next) {
    if (child.type === "html_inline") {
      output += child.literal;
    } else if (child.type === "text" || child.type === "code") {
      output += child.literal.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
    } else if (child.type === "softbreak" || child.type === "linebreak") {
      output += " ";
    } else {
      output += inlineHtmlSource(child);
    }
  }
  return output;
}

function htmlHeadingTexts(value) {
  const source = visibleHtmlSource(value);
  const headings = [];
  let activeHeading = null;
  for (let index = 0; index < source.length; index += 1) {
    const tag = htmlTagAt(source, index);
    if (!tag) continue;
    const isHeading =
      tag.name.length === 2 &&
      tag.name[0] === "h" &&
      tag.name[1] >= "1" &&
      tag.name[1] <= "6";
    if (isHeading && !tag.closing && !activeHeading) {
      activeHeading = { contentStart: tag.end + 1, name: tag.name };
    } else if (tag.closing && tag.name === activeHeading?.name) {
      const content = visibleHtmlText(
        source.slice(activeHeading.contentStart, index),
      ).trim();
      if (content) headings.push(content);
      activeHeading = null;
    }
    index = tag.end;
  }
  if (activeHeading) {
    const content = visibleHtmlText(source.slice(activeHeading.contentStart));
    if (content.trim()) headings.push(content.trim());
  }
  return headings;
}

function markdownPolicyStructure(body) {
  const document = markdownReader.parse(body);
  const headings = [];
  const prose = [];
  const listIds = new WeakMap();
  let nextListId = 1;
  const walker = document.walker();
  let event;
  while ((event = walker.next())) {
    if (!event.entering) continue;
    let content = "";
    if (event.node.type === "heading") {
      content = nodeText(event.node, false);
      headings.push(content);
    } else if (event.node.type === "html_block") {
      headings.push(...htmlHeadingTexts(event.node.literal));
      content = visibleHtmlText(event.node.literal);
    } else if (event.node.type === "paragraph") {
      content = nodeText(event.node);
      headings.push(...htmlHeadingTexts(inlineHtmlSource(event.node)));
    }
    if (!content.trim()) continue;
    const lists = ancestorLists(event.node);
    const recordListIds = lists.map((list) => {
      if (!listIds.has(list)) listIds.set(list, nextListId++);
      return listIds.get(list);
    });
    const [[startLine], [endLine]] = event.node.sourcepos;
    prose.push({
      content,
      endLine,
      listId: recordListIds[0] ?? null,
      listIds: recordListIds,
      referenceContexts: lists
        .map((list, index) => {
          const reference = listReferenceContext(list);
          if (!reference) return null;
          return { ...reference, listId: recordListIds[index] };
        })
        .filter(Boolean),
      startLine,
    });
  }
  return { headings, prose };
}

function normalizeWorkflowText(value) {
  return value
    // Normalize ASCII and common Unicode arrows before comparing workflow signatures.
    .replace(/\s*(?:->|[→⇒⟶])\s*/g, " -> ")
    .trim()
    // Markdown and decoded HTML may produce tabs, newlines, or non-breaking spaces.
    .split(/\s+/)
    .join(" ")
    .toLowerCase();
}

function containsOwnedHeading(headings, definition) {
  const normalized = new Set(headings.map(normalizeWorkflowText));
  return definition.headings.some((heading) =>
    normalized.has(normalizeWorkflowText(heading)),
  );
}

function neutralReferenceRemainder(
  content,
  definition,
  normalizedTokens,
  namesRequired = true,
) {
  const line = normalizeWorkflowText(content);
  const names = normalizedTokens.filter((token) => line.includes(token));
  if (namesRequired && names.length === 0) return null;
  let remainder = line;
  for (const path of workflowAuthorityPaths(definition)) {
    remainder = remainder.replaceAll(normalizeWorkflowText(path), "");
  }
  for (const token of names) remainder = remainder.replaceAll(token, "");
  if (remainder.includes("->")) return remainder;
  remainder = remainder.replace(/[\u2019']s\b/g, "");
  // Only neutral citation vocabulary may remain after workflow names and the owner path are removed.
  const neutralReferenceWords = new RegExp(
    [
      "详见", "参考", "权威来源", "权威", "为准", "名称", "术语", "流程",
      "入口", "包括", "包含", "定义", "说明", "分别", "各自", "对应",
      "相关", "均", "各", "下列", "本", "其", "的", "见", "以", "由", "及", "和",
    ].join("|"),
    "g",
  );
  const neutralEnglishWords = new RegExp(
    "\\b(?:see|refer|to|reference|authority|source|defined|definition|" +
      "according|by|the|each|all|respectively|and|or|for|in|is|are|as)\\b",
    "g",
  );
  remainder = remainder
    .replace(neutralReferenceWords, "")
    .replace(neutralEnglishWords, "")
    // Punctuation and Markdown delimiters do not add local execution semantics.
    .replace(/[\s,.;:，。；：、()[\]{}<>“”"'’`-]/g, "");
  return remainder;
}

function workflowAuthorityPaths(definition) {
  const paths = new Set([definition.authorityPath]);
  for (const tokenPaths of Object.values(definition.tokenAuthorityPaths ?? {})) {
    for (const path of tokenPaths) paths.add(path);
  }
  return [...paths];
}

function authorityPathsForToken(definition, normalizedToken) {
  const originalToken = definition.signatureTokens.find(
    (token) => normalizeWorkflowText(token) === normalizedToken,
  );
  return [
    definition.authorityPath,
    ...(definition.tokenAuthorityPaths?.[originalToken] ?? []),
  ];
}

function textOccurrences(line, values) {
  const occurrences = [];
  for (const value of values) {
    const normalized = normalizeWorkflowText(value);
    let offset = 0;
    while (offset < line.length) {
      const index = line.indexOf(normalized, offset);
      if (index < 0) break;
      occurrences.push({ index, value: normalized });
      offset = index + normalized.length;
    }
  }
  return occurrences.sort((left, right) => left.index - right.index);
}

function hasAuthoritiesForTokens(content, definition, normalizedTokens) {
  const line = normalizeWorkflowText(content);
  const names = textOccurrences(line, normalizedTokens);
  if (names.length === 0) return false;
  const paths = textOccurrences(line, workflowAuthorityPaths(definition));
  if (paths.length === 0) return false;
  const pathIsAllowed = (name, path) =>
    authorityPathsForToken(definition, name.value)
      .map(normalizeWorkflowText)
      .includes(path.value);
  if (paths.length === 1) {
    return names.every((name) => pathIsAllowed(name, paths[0]));
  }
  if (paths.length !== names.length) return false;
  return names.every((name, index) => pathIsAllowed(name, paths[index]));
}

function hasExplicitOwnerPath(content) {
  return /(?:skills|commands|agents|rules)\/[\w./-]+\.md/i.test(content);
}

function withReferenceContext(content, referenceContent) {
  if (hasExplicitOwnerPath(content)) return content;
  return `${content} ${referenceContent}`.trim();
}

function hasCitationVocabulary(content) {
  const normalized = normalizeWorkflowText(content);
  return (
    /见|详见|参考|为准|权威/.test(content) ||
    /\b(?:see|refer(?:red)?\s+to|reference|authority|defined\s+by|according\s+to)\b/.test(
      normalized,
    )
  );
}

function isNeutralReference(content, definition, normalizedTokens) {
  if (!hasAuthoritiesForTokens(content, definition, normalizedTokens)) {
    return false;
  }
  // Only explicit citation wording can turn workflow names into neutral references.
  if (!hasCitationVocabulary(content)) return false;
  return neutralReferenceRemainder(content, definition, normalizedTokens) === "";
}

function isNeutralContextIntro(content, definition) {
  if (
    !workflowAuthorityPaths(definition).some((path) => content.includes(path))
  ) {
    return false;
  }
  // Context introductions use the same citation vocabulary but need no workflow signature name.
  if (!hasCitationVocabulary(content)) return false;
  return neutralReferenceRemainder(content, definition, [], false) === "";
}

function hasLocalWorkflowDirective(content) {
  const normalized = normalizeWorkflowText(content);
  return LOCAL_WORKFLOW_DIRECTIVE_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  );
}

function adjacentRecords(groupRecords, records) {
  const groupSet = new Set(groupRecords);
  const firstLine = Math.min(...groupRecords.map((record) => record.startLine));
  const lastLine = Math.max(...groupRecords.map((record) => record.endLine));
  let previous = null;
  let next = null;
  for (const candidate of records) {
    if (groupSet.has(candidate)) continue;
    if (
      candidate.endLine < firstLine &&
      (!previous || candidate.endLine > previous.endLine)
    ) {
      previous = candidate;
    }
    if (
      candidate.startLine > lastLine &&
      (!next || candidate.startLine < next.startLine)
    ) {
      next = candidate;
    }
  }
  return { next, previous };
}

function extendAuthorityBoundaries(groupRecords, records, definition) {
  const extended = [...groupRecords];
  while (true) {
    const { next, previous } = adjacentRecords(extended, records);
    const neutralBoundaries = [previous, next].filter(
      (candidate) =>
        candidate && isNeutralContextIntro(candidate.content, definition),
    );
    if (neutralBoundaries.length === 0) return extended;
    extended.push(...neutralBoundaries);
  }
}

function hasAdjacentLocalDirective(groupRecords, records, definition) {
  const extended = extendAuthorityBoundaries(
    groupRecords,
    records,
    definition,
  );
  const { next, previous } = adjacentRecords(extended, records);
  // A nearest visible block with execution wording changes citations into a local procedure.
  return [previous, next].some(
    (candidate) => candidate && hasLocalWorkflowDirective(candidate.content),
  );
}

function listHasAdjacentDirective(
  groupId,
  records,
  definition,
  boundaryRecords = [],
) {
  const groupRecords = [
    ...records.filter((record) => record.listIds.includes(groupId)),
    ...boundaryRecords,
  ];
  return hasAdjacentLocalDirective(groupRecords, records, definition);
}

function independentReferenceGroup(record, records, definition, tokens) {
  const recordIndex = records.indexOf(record);
  let firstIndex = recordIndex;
  let lastIndex = recordIndex;
  const isReference = (candidate) => {
    const normalized = normalizeWorkflowText(candidate.content);
    const hasSignature = tokens.some((token) => normalized.includes(token));
    return (
    candidate.listId === null &&
      hasSignature &&
      hasCitationVocabulary(candidate.content)
    );
  };
  while (firstIndex > 0 && isReference(records[firstIndex - 1])) {
    firstIndex -= 1;
  }
  while (lastIndex + 1 < records.length && isReference(records[lastIndex + 1])) {
    lastIndex += 1;
  }
  return records.slice(firstIndex, lastIndex + 1);
}

function independentReferencesUseOnlyCitations(
  record,
  records,
  definition,
  tokens,
) {
  const group = independentReferenceGroup(record, records, definition, tokens);
  return (
    group.every((candidate) =>
      isNeutralReference(candidate.content, definition, tokens),
    ) && !hasAdjacentLocalDirective(group, records, definition)
  );
}

function listUsesOnlyDirectReferences(record, records, definition, tokens) {
  return record.listIds.every((groupId) => {
    if (listHasAdjacentDirective(groupId, records, definition)) return false;
    return records
      .filter((candidate) => candidate.listIds.includes(groupId))
      .every((candidate) =>
        isNeutralReference(candidate.content, definition, tokens),
      );
  });
}

function listUsesOnlyContextReferences(
  record,
  reference,
  records,
  definition,
  tokens,
) {
  const referenceIndex = record.listIds.indexOf(reference.listId);
  if (referenceIndex < 0) return false;
  const ancestorGroupIds = record.listIds.slice(referenceIndex);
  return ancestorGroupIds.every((groupId) => {
    if (listHasAdjacentDirective(groupId, records, definition, [reference])) {
      return false;
    }
    return records
      .filter((candidate) => candidate.listIds.includes(groupId))
      .every((candidate) => {
        const content = withReferenceContext(
          candidate.content,
          reference.content,
        );
        return (
          isNeutralReference(content, definition, tokens) ||
          isNeutralContextIntro(candidate.content, definition)
        );
      });
  });
}

function isPureAuthorityReference(record, records, definition, tokens) {
  if (isNeutralReference(record.content, definition, tokens)) {
    const directReferencesArePure =
      record.listId === null
        ? independentReferencesUseOnlyCitations(
            record,
            records,
            definition,
            tokens,
          )
        : listUsesOnlyDirectReferences(record, records, definition, tokens);
    if (directReferencesArePure) {
      return true;
    }
  }
  for (const reference of record.referenceContexts) {
    if (!isNeutralContextIntro(reference.content, definition)) continue;
    const candidate = withReferenceContext(record.content, reference.content);
    if (
      isNeutralReference(candidate, definition, tokens) &&
      listUsesOnlyContextReferences(
        record,
        reference,
        records,
        definition,
        tokens,
      )
    ) {
      return true;
    }
  }
  return false;
}

function containsOwnedSignatures(prose, definition) {
  const matchedSignatures = new Set();
  const matchedDetectionTokens = new Set();
  const referenceTokens = definition.signatureTokens.map(normalizeWorkflowText);
  const detectionTokens = (definition.detectionTokens ?? []).map(
    normalizeWorkflowText,
  );
  for (const record of prose) {
    const line = normalizeWorkflowText(record.content);
    if (isPureAuthorityReference(record, prose, definition, referenceTokens)) {
      continue;
    }
    for (const token of referenceTokens) {
      if (line.includes(token)) matchedSignatures.add(token);
    }
    for (const token of detectionTokens) {
      if (line.includes(token)) matchedDetectionTokens.add(token);
    }
  }
  return (
    matchedSignatures.size >= definition.minimumSignatureMatches ||
    matchedDetectionTokens.size >= (definition.detectionMinimumMatches ?? Infinity)
  );
}

function detectsWorkflowDefinition(body, definition) {
  const { headings, prose } = markdownPolicyStructure(body);
  return (
    containsOwnedHeading(headings, definition) ||
    containsOwnedSignatures(prose, definition)
  );
}



function verifyDetectorFixtures(definition, fail) {
  if (
    allowedFixtures(definition).some((fixture) =>
      detectsWorkflowDefinition(fixture, definition),
    )
  ) {
    fail(`workflow ownership detector must allow ${definition.label} references`);
  }
  if (
    rejectedFixtures(definition).some((fixture) =>
      !detectsWorkflowDefinition(fixture, definition),
    )
  ) {
    fail(`workflow ownership detector must reject copied ${definition.label}`);
  }
}

function workflowCopyFiles(ruleFiles, read, definition) {
  return ruleFiles.filter((file) =>
    detectsWorkflowDefinition(read(file), definition),
  );
}

function verifyRepositoryScopeFixture(definition, fail) {
  const fixtureFile = "rules/common/unrelated.md";
  const fixtureBody = repositoryScopeFixture(definition);
  const copies = workflowCopyFiles([fixtureFile], () => fixtureBody, definition);
  if (!copies.includes(fixtureFile)) {
    fail(`workflow ownership detector must scan every Rule for ${definition.label}`);
  }
}

/**
 * Check that Rules reference workflow owners instead of copying their procedures.
 * @param {object} context Harness file access and failure collector.
 * @returns {void}
 */
function runWorkflowOwnershipChecks({ read, fail, managedFiles }) {
  const ruleFiles = managedFiles().filter(
    (file) => file.startsWith("rules/") && file.endsWith(".md"),
  );
  for (const definition of WORKFLOW_DEFINITIONS) {
    verifyDetectorFixtures(definition, fail);
    verifyRepositoryScopeFixture(definition, fail);
    for (const file of workflowCopyFiles(ruleFiles, read, definition)) {
      fail(`${file} must reference ${definition.label} rather than define it`);
    }
  }
}

module.exports = { runWorkflowOwnershipChecks };
