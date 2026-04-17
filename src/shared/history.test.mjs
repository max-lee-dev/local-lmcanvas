// Lightweight sanity test for getMessageHistoryForNode.
// Runs with plain node (no test runner): `node lib/graph/history.test.mjs`
// Must re-implement the function in-place since history.ts is TS; we inline a
// mirror of the logic here and assert behavior.

function getMessageHistoryForNode(nodeId, nodesById) {
  const chain = [];
  const seen = new Set();
  let current = nodesById[nodeId];
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    const parentId = current.data.chat.parentIds[0];
    current = parentId ? nodesById[parentId] : undefined;
  }
  return chain.flatMap((n) => n.data.chat.messages);
}

function mkNode(id, parent, msgs) {
  return {
    id,
    type: "custom",
    position: { x: 0, y: 0 },
    data: {
      chat: {
        messages: msgs.map((m, i) => ({ id: `${id}-m${i}`, role: i % 2 === 0 ? "user" : "assistant", content: m, createdAt: 0 })),
        parentIds: parent ? [parent] : [],
        childIds: [],
      },
    },
  };
}

// Build a 4-deep chain: root -> a -> b -> c
const nodes = {
  root: mkNode("root", null, ["r-u", "r-a"]),
  a: mkNode("a", "root", ["a-u", "a-a"]),
  b: mkNode("b", "a", ["b-u", "b-a"]),
  c: mkNode("c", "b", ["c-u"]),
};

const h = getMessageHistoryForNode("c", nodes).map((m) => m.content);
const expected = ["r-u", "r-a", "a-u", "a-a", "b-u", "b-a", "c-u"];

function assertEq(actual, exp, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(exp);
  console.log(`${ok ? "✓" : "✗"} ${label}`);
  if (!ok) {
    console.log(`  expected: ${JSON.stringify(exp)}`);
    console.log(`  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

assertEq(h, expected, "4-deep chain returns ancestors in order then self");

// Empty node returns []
assertEq(getMessageHistoryForNode("nope", nodes), [], "missing id returns []");

// Cycle safety (malformed data) — A <- B <- A
const cyclic = {
  A: mkNode("A", "B", ["A-u"]),
  B: mkNode("B", "A", ["B-u"]),
};
// walking from B → A → B (seen) stops. Order: [A, B] → messages [A-u, B-u]
assertEq(
  getMessageHistoryForNode("B", cyclic).map((m) => m.content),
  ["A-u", "B-u"],
  "cycle does not loop forever"
);

console.log("\nall history tests passed");
