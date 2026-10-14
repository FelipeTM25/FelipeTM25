import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const { PROFILE_TOKEN, GH_USER, OUT = "dist/activity-radar.svg" } = process.env;
if (!PROFILE_TOKEN || !GH_USER) throw new Error("PROFILE_TOKEN and GH_USER are required");

const query = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `bearer ${PROFILE_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { login: GH_USER } }),
});
const json = await res.json();
if (!res.ok || json.errors) throw new Error(JSON.stringify(json.errors ?? res.statusText));

const c = json.data.user.contributionsCollection;
// Top, right, bottom, left — same layout as the GitHub profile overview.
const axes = [
  { label: "Code review", value: c.totalPullRequestReviewContributions, angle: -90 },
  { label: "Issues", value: c.totalIssueContributions, angle: 0 },
  { label: "Commits", value: c.totalCommitContributions, angle: 90 },
  { label: "Pull requests", value: c.totalPullRequestContributions, angle: 180 },
];

const total = axes.reduce((s, a) => s + a.value, 0) || 1;
const W = 520, H = 340, cx = W / 2, cy = H / 2, R = 105, MIN = 0.06;
const point = (angle, r) => {
  const t = (angle * Math.PI) / 180;
  return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
};
const fmt = (p) => p.map((n) => n.toFixed(1)).join(",");

const rings = [0.25, 0.5, 0.75, 1].map((k) =>
  `<polygon points="${axes.map((a) => fmt(point(a.angle, R * k))).join(" ")}" fill="none" stroke="#8b949e" stroke-opacity="0.25"/>`
).join("");
const spokes = axes.map((a) => {
  const [x, y] = point(a.angle, R);
  return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="#8b949e" stroke-opacity="0.25"/>`;
}).join("");
const shape = axes.map((a) => point(a.angle, R * Math.max(a.value / total, MIN)));
const dots = shape.map((p) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="#58a6ff"/>`).join("");

const labelPos = [
  { x: cx, y: cy - R - 26, anchor: "middle" },
  { x: cx + R + 18, y: cy - 4, anchor: "start" },
  { x: cx, y: cy + R + 34, anchor: "middle" },
  { x: cx - R - 18, y: cy - 4, anchor: "end" },
];
const labels = axes.map((a, i) => {
  const { x, y, anchor } = labelPos[i];
  const pct = Math.round((a.value / total) * 100);
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="#8b949e" font-size="14" font-weight="600">${a.label}</text>` +
    `<text x="${x}" y="${y + 18}" text-anchor="${anchor}" fill="#58a6ff" font-size="13">${a.value.toLocaleString("en-US")} · ${pct}%</text>`;
}).join("");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
<title>Activity overview</title>
${rings}${spokes}
<polygon points="${shape.map(fmt).join(" ")}" fill="#1f6feb" fill-opacity="0.35" stroke="#58a6ff" stroke-width="2"/>
${dots}${labels}
</svg>
`;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg);
console.log(`Wrote ${OUT}`, Object.fromEntries(axes.map((a) => [a.label, a.value])));
