"use strict";

function encodeFirstSpace(tokens, entity) {
  return tokens.map((token) => token.replace(" ", entity)).join(" -> ");
}

function repositoryScopeFixture(definition) {
  const [first, second, third] = definition.signatureTokens;
  return `## 替代标题\n1. ${first}\n2. ${second}\n3. ${third}`;
}

function fixtureAuthorityPath(definition, token) {
  return definition.tokenAuthorityPaths?.[token]?.[0] ?? definition.authorityPath;
}

function fixtureWrongAuthorityPath(definition, token) {
  const allowedPaths = new Set([
    definition.authorityPath,
    ...(definition.tokenAuthorityPaths?.[token] ?? []),
  ]);
  const allPaths = new Set([definition.authorityPath]);
  for (const tokenPaths of Object.values(definition.tokenAuthorityPaths ?? {})) {
    for (const path of tokenPaths) allPaths.add(path);
  }
  return (
    [...allPaths].find((path) => !allowedPaths.has(path)) ??
    "skills/unrelated/SKILL.md"
  );
}

function allowedReferenceFixtures(definition) {
  const [first, second, third] = definition.signatureTokens;
  const directList = [first, second, third]
    .map((token) => `- ${token} 见 \`${definition.authorityPath}\`。`)
    .join("\n");
  const distributedList = definition.signatureTokens
    .map((token) => `- ${token} 见 \`${fixtureAuthorityPath(definition, token)}\`。`)
    .join("\n");
  const aggregate =
    `${definition.signatureTokens.join("、")}，` +
    `均以 \`${definition.authorityPath}\` 为准。`;
  const distributed =
    `${definition.signatureTokens.join("、")}，分别见 ` +
    definition.signatureTokens
      .map((token) => `\`${fixtureAuthorityPath(definition, token)}\``)
      .join("、");
  const possessiveList = definition.signatureTokens
    .map((token) =>
      `- ${token} 的权威定义见 \`${fixtureAuthorityPath(definition, token)}\`。`,
    )
    .join("\n");
  const englishList = definition.signatureTokens
    .map((token) =>
      `- ${token}: see \`${fixtureAuthorityPath(definition, token)}\`.`,
    )
    .join("\n");
  const englishPossessiveList = definition.signatureTokens
    .map((token) =>
      `- ${token}'s authority is ` +
      `\`${fixtureAuthorityPath(definition, token)}\`.`,
    )
    .join("\n");
  const englishAggregate =
    `${definition.signatureTokens.join(", ")} are all defined by ` +
    `\`${definition.authorityPath}\`.`;
  const contextWithHeading = [
    `流程定义以 \`${definition.authorityPath}\` 为准。`,
    "",
    `- ${first}`,
    "",
    `  ### ${second}`,
    `- ${third}`,
  ].join("\n");
  const nestedContext = [
    `- 流程定义以 \`${definition.authorityPath}\` 为准：`,
    `  - ${first}`,
    `  - ${second}`,
    `  - ${third}`,
  ].join("\n");
  const commentSeparatedContext = [
    `流程定义以 \`${definition.authorityPath}\` 为准。`,
    "<!-- reference separator -->",
    `- ${first}`,
    `- ${second}`,
    `- ${third}`,
  ].join("\n");
  return [
    `## 引用\n${definition.label} 见 \`${definition.authorityPath}\`。`,
    `- ${definition.label} 见 \`${definition.authorityPath}\`。`,
    `- ${first} 见 \`${definition.authorityPath}\`。`,
    [first, second, third]
      .map((token) => `${token} 见 \`${definition.authorityPath}\`。`)
      .join("\n\n"),
    directList,
    distributedList,
    aggregate,
    distributed,
    possessiveList,
    englishList,
    englishPossessiveList,
    englishAggregate,
    `流程定义以 \`${definition.authorityPath}\` 为准。\n\n- ${first}\n- ${second}\n- ${third}`,
    contextWithHeading,
    nestedContext,
    commentSeparatedContext,
  ];
}

function allowedHiddenFixtures(definition) {
  const [first, second, third] = definition.signatureTokens;
  const heading = definition.headings[0];
  const nestedTemplate = [
    "<template>",
    "<template>inner</template>",
    `<div>${first} -> ${second} -> ${third}</div>`,
    "</template>",
  ].join("\n");
  return [
    `- ${heading}\n---`,
    `- ${heading}\n- ---`,
    `\`\`\`markdown\n## ${heading}\n1. ${first}\n2. ${second}\n3. ${third}\n\`\`\``,
    `- \`\`\`markdown\n  ## ${heading}\n  1. ${first}\n  2. ${second}\n  3. ${third}\n  \`\`\``,
    `- 示例\n \t\`\`\`markdown\n \t## ${heading}\n \t1. ${first}\n \t2. ${second}\n \t3. ${third}\n \t\`\`\``,
    `> \`\`\`markdown\n>> \`\`\`\n> ## ${heading}\n> \`\`\`\``,
    `> - \`\`\`markdown\n>   示例\n    ## ${heading}`,
    `    ~~~markdown\n    ## ${heading}\n    1. ${first}\n    2. ${second}\n    3. ${third}\n  ~~~`,
    `\`\`\`markdown\n\`\`\`not-close\n## ${heading}\n1. ${first}\n2. ${second}\n3. ${third}\n\`\`\``,
    `    ## ${heading}\n    1. ${first}\n    2. ${second}\n    3. ${third}`,
    `<!-- ## ${heading} -->`,
    `<!-- ## ${heading}\n1. ${first}\n2. ${second}\n3. ${third}`,
    `<!-- <div>${first} -> ${second} -> ${third}</div> -->`,
    `<!-- <h2>${heading}</h2> -->`,
    `<script>${first} -> ${second} -> ${third}</script>`,
    `<script><h2>${heading}</h2></script>`,
    `<style>${first} -> ${second} -> ${third}</style>`,
    `<template>${first} -> ${second} -> ${third}</template>`,
    `<pre><code>${first} -> ${second} -> ${third}</code></pre>`,
    nestedTemplate,
    `说明 <script>${first} -> ${second} -> ${third}</script>`,
    `<div data-flow="${first} -> ${second} -> ${third}">引用说明</div>`,
  ];
}

function allowedFixtures(definition) {
  const fixtures = [
    ...allowedReferenceFixtures(definition),
    ...allowedHiddenFixtures(definition),
  ];
  if (!definition.signatureTokens.some((token) => token.includes("->"))) {
    const [first, second, third] = definition.signatureTokens;
    fixtures.push(
      `- ${first}、${second}、${third}，见 \`${definition.authorityPath}\`。`,
    );
  }
  return fixtures;
}

function rejectedReferenceFixtures(definition, first, second, third) {
  const directReferenceWithLocalStep = [
    `- ${first} 见 \`${definition.authorityPath}\`。`,
    `- ${second} 见 \`${definition.authorityPath}\`。`,
    `- ${third} 见 \`${definition.authorityPath}\`。`,
    "- 按顺序执行上述步骤，并在最后自动发布。",
  ].join("\n");
  const contextReferenceWithNestedHeading = [
    `流程定义以 \`${definition.authorityPath}\` 为准。`,
    "",
    `- ${first}`,
    "",
    "  ### 按顺序执行并自动发布",
    `- ${second}`,
    `- ${third}`,
  ].join("\n");
  const nestedDirectReferenceWithOuterHeading = [
    "- 引用容器",
    `  - ${first} 见 \`${definition.authorityPath}\`。`,
    `  - ${second} 见 \`${definition.authorityPath}\`。`,
    `  - ${third} 见 \`${definition.authorityPath}\`。`,
    "",
    "  ### 按顺序执行上述步骤并自动发布",
  ].join("\n");
  const nestedContextReferenceWithOuterHeading = [
    `- 流程定义以 \`${definition.authorityPath}\` 为准：`,
    `  - ${first}`,
    `  - ${second}`,
    `  - ${third}`,
    "",
    "  ### 按顺序执行上述步骤并自动发布",
  ].join("\n");
  return [
    directReferenceWithLocalStep,
    contextReferenceWithNestedHeading,
    nestedDirectReferenceWithOuterHeading,
    nestedContextReferenceWithOuterHeading,
  ];
}

function adjacentReferenceFixtures(definition, first, second, third) {
  const direct = [first, second, third]
    .map((token) => `- ${token} 见 \`${definition.authorityPath}\``)
    .join("\n");
  const independent = [first, second, third]
    .map((token) => `${token} 见 \`${definition.authorityPath}\``)
    .join("\n\n");
  const context = [
    `流程定义以 \`${definition.authorityPath}\` 为准。`,
    `- ${first}`,
    `- ${second}`,
    `- ${third}`,
  ].join("\n");
  const directiveTexts = [
    "按顺序执行上述步骤，并在最后自动发布",
    "遵循上述步骤",
    "先完成上述步骤，再发布",
    "上述步骤必须执行",
    "按上述步骤执行",
    "以上流程需要完成",
    "前述门禁必须遵循",
    "随后执行上述步骤",
    "上述步骤完成后发布",
    "遵照以上流程",
    "Follow the steps above",
    "The above steps must be completed",
    "The steps above must be completed",
    "The workflow above will be automatically deployed",
    "The workflow will automatically be deployed",
    "The changes will automatically be committed",
    "The branch will automatically be merged",
    "The workflow automatically publishes",
    "The workflow merges automatically",
    "The workflow is auto-merged",
    "Then execute the previous workflow",
    "Execute the following steps",
    "Complete the steps below",
  ];
  const directives = directiveTexts.flatMap((text) => [
    `${text}。`,
    `### ${text}`,
    `<h3>${text}</h3>`,
  ]);
  const authorityIntro = `权威来源见 \`${definition.authorityPath}\`。`;
  const masked = [
    `${directives[0]}\n\n${authorityIntro}\n\n${direct}`,
    `${directives[0]}\n\n${authorityIntro}\n\n${independent}`,
    `${direct}\n\n${authorityIntro}\n\n${directives[0]}`,
    `${independent}\n\n${authorityIntro}\n\n${directives[0]}`,
  ];
  return [
    ...masked,
    ...directives.flatMap((adjacent) => [
    `${direct}\n\n${adjacent}`,
    `${context}\n\n${adjacent}`,
    `${independent}\n\n${adjacent}`,
    `${adjacent}\n\n${direct}`,
    `${adjacent}\n\n${context}`,
    `${adjacent}\n\n${independent}`,
    ]),
  ];
}

function rejectedOwnerFixtures(definition) {
  const [first, second, third] = definition.signatureTokens;
  const independentWithWrongOwner = [
    `${first} 见 \`${fixtureAuthorityPath(definition, first)}\`。`,
    `${second} 见 \`${fixtureWrongAuthorityPath(definition, second)}\`。`,
    `${third} 见 \`${fixtureAuthorityPath(definition, third)}\`。`,
  ].join("\n\n");
  const tokens = definition.signatureTokens;
  const paths = tokens.map((token) => fixtureAuthorityPath(definition, token));
  const distinctIndex = paths.findIndex((path) => path !== paths[0]);
  if (distinctIndex < 0) {
    paths[0] = fixtureWrongAuthorityPath(definition, tokens[0]);
  } else {
    [paths[0], paths[distinctIndex]] = [paths[distinctIndex], paths[0]];
  }
  const swappedAggregateOwners =
    `${tokens.join("、")}，分别见 ` + paths.map((path) => `\`${path}\``).join("、");
  const contextWithExplicitWrongOwner = [
    `权威来源见 \`${definition.authorityPath}\`。`,
    "",
    `- ${first} 见 \`${fixtureWrongAuthorityPath(definition, first)}\`。`,
    `- ${second}`,
    `- ${third}`,
  ].join("\n");
  return [
    independentWithWrongOwner,
    swappedAggregateOwners,
    contextWithExplicitWrongOwner,
  ];
}

function rejectedFixtures(definition) {
  const [first, second, third] = definition.signatureTokens;
  const heading = definition.headings[0];
  const encodedTokens = encodeFirstSpace([first, second, third], "&#32;");
  const unterminatedEncodedTokens = encodeFirstSpace(
    [first, second, third],
    "&#32",
  );
  const fixtures = [
    `## **${heading}** ##\n流程在本规则定义。`,
    `## [${heading}](#workflow)`,
    `### ${first}\n### ${second}\n### ${third}`,
    `${heading}\n---`,
    `## 替代标题\n1. ${first}\n2. ${second}\n3. ${third}`,
    `## 替代标题\n- ${first}\n- ${second}\n- ${third}`,
    `- 嵌套流程\n    1. ${first}\n    2. ${second}\n    3. ${third}`,
    `    \`\`\`markdown\n## ${heading}\n1. ${first}\n2. ${second}\n3. ${third}`,
    `说明 \`<!--\` 不是注释\n## ${heading}\n流程在本规则定义。`,
    `## 替代标题\n1. **${first}**，见 \`${definition.authorityPath}\`\n2. ${second}\n3. ${third}`,
    `${first} -> ${second} -> ${third}，详见 \`${definition.authorityPath}\`。`,
    `先执行 ${first}，再完成 ${second}，最后进入 ${third}；详见 \`${definition.authorityPath}\`。`,
    `- 先执行 ${first}，再完成 ${second}，最后进入 ${third}；详见 \`${definition.authorityPath}\`。`,
    `流程定义以 \`${definition.authorityPath}\` 为准。\n\n- ${first}\n- ${second}\n- 本地执行 ${third}`,
    `流程定义以 \`${definition.authorityPath}\` 为准。\n\n` +
      `- ${first}\n- ${second}\n- ${third}\n` +
      "- 按顺序执行上述步骤，并在最后自动发布",
    ...rejectedReferenceFixtures(definition, first, second, third),
    ...adjacentReferenceFixtures(definition, first, second, third),
    ...rejectedOwnerFixtures(definition),
    `<div>${first} -> ${second} -> ${third}</div>`,
    `<div>${first} < ${second} > ${third}</div>`,
    `<div>${encodedTokens}</div>`,
    `<div>${unterminatedEncodedTokens}</div>`,
    `<h2>${heading}</h2>`,
    `前言 <h2>${heading}</h2>`,
    `流程：<span>${first} -> ${second} -> ${third}</span>`,
    `流程如下：\n    ${first} -> ${second} -> ${third}`,
    `- 流程如下：\n      ${first} -> ${second} -> ${third}`,
    `<!--\n\`\`\`markdown\n-->\n## ${heading}`,
    `<!--\n~~~markdown\n-->\n## ${heading}`,
    `    <!--\n## ${heading}`,
    `-\n  \`\`\`markdown\n  示例\n    \`\`\`\n## ${heading}`,
    `-\n  ~~~markdown\n  示例\n     ~~~\n## ${heading}`,
    `> \`\`\`markdown\n> 示例\n## ${heading}`,
    `> <!--\n> 示例\n## ${heading}`,
    `> \`\`\`markdown\n\n> ## ${heading}`,
    `> <!--\n\n> ## ${heading}`,
    `- \`\`\`markdown\n  示例\n## ${heading}`,
    `-\t\`\`\`markdown\n  ## ${heading}`,
    `\`\`\`markdown\`invalid\n## ${heading}`,
  ];
  if (definition.detectionTokens) {
    fixtures.push(
      definition.detectionTokens
        .map((token, index) => `${index + 1}. ${token}`)
        .join("\n"),
      definition.detectionTokens.join("，然后"),
    );
  }
  if (definition.signatureTokens.some((token) => token.includes("->"))) {
    fixtures.push(
      `## 替代标题\n${definition.signatureTokens
        .slice(0, 3)
        .map((token) => token.replaceAll("->", "→"))
        .join(" → ")}`,
      definition.signatureTokens
        .slice(0, 3)
        // Remove optional ASCII-arrow spacing to exercise compact Unicode-arrow normalization.
        .map((token) => token.replace(/\s*->\s*/g, "→"))
        .join("→"),
    );
  }
  return fixtures;
}

module.exports = {
  allowedFixtures,
  rejectedFixtures,
  repositoryScopeFixture,
};
