import type { Connection } from "@/lib/types";

// 8 fake connections at varied warmth levels so the map never looks empty
// during development or if live demo data is thin.
export const seedConnections: Connection[] = [
  {
    id: "seed-1",
    owner_id: "dev-user-1",
    person: { name: "Ava Chen", org: "Carnegie Mellon University", links: { github: "https://github.com/avachen" } },
    met: { context_type: "conference", place_label: "Career Fair", ts: "2026-08-20T10:00:00Z" },
    notes: ["works on inference optimization"],
    enrichment: {
      role: "PhD Student",
      interests: ["LLM inference", "sparse routing"],
      recent_activity: [
        { fact: "Published a paper on sparse routing three weeks ago.", source_url: "https://arxiv.org/abs/2024.sparse-routing", date: null },
      ],
      links: {},
    },
    warmth: 0.9,
    last_touch: "2026-09-10T10:00:00Z",
  },
  {
    id: "seed-2",
    owner_id: "dev-user-1",
    person: { name: "Marcus Reyes", org: "Querit.ai", links: { linkedin: "https://linkedin.com/in/marcusreyes" } },
    met: { context_type: "work", place_label: "Sponsor booth" },
    notes: [],
    enrichment: {
      role: "Search Engineer",
      interests: ["search APIs", "agents"],
      recent_activity: [
        { fact: "Gave a talk on real-time search APIs for agents.", source_url: "https://querit.ai/blog/real-time-search-for-agents", date: null },
      ],
      links: {},
    },
    warmth: 0.85,
    last_touch: "2026-09-09T10:00:00Z",
  },
  {
    id: "seed-3",
    owner_id: "dev-user-1",
    person: { name: "Priya Nair", org: "MongoDB", links: { twitter: "https://twitter.com/priyanair" } },
    met: { context_type: "club", place_label: "Campus club fair" },
    notes: [],
    enrichment: {
      role: "Developer Advocate",
      interests: ["vector search", "databases"],
      recent_activity: [
        { fact: "Wrote a blog post on vector search indexes in Atlas.", source_url: "https://mongodb.com/blog/vector-search-atlas", date: null },
      ],
      links: {},
    },
    warmth: 0.6,
    last_touch: "2026-08-25T10:00:00Z",
  },
  {
    id: "seed-4",
    owner_id: "dev-user-1",
    person: { name: "Diego Alvarez", org: "Institute of Foundation Models", links: {} },
    met: { context_type: "conference", place_label: "IFM Talk" },
    notes: [],
    enrichment: {
      role: "Research Engineer",
      interests: ["model routing", "benchmarks"],
      recent_activity: [
        { fact: "Released a benchmark comparing routing strategies.", source_url: "https://ifm.ai/research/routing-benchmark", date: null },
      ],
      links: {},
    },
    warmth: 0.5,
    last_touch: "2026-08-20T10:00:00Z",
  },
  {
    id: "seed-5",
    owner_id: "dev-user-1",
    person: { name: "Sofia Kim", org: "Vultr", links: { linkedin: "https://linkedin.com/in/sofiakim" } },
    met: { context_type: "campus", place_label: "Workshop" },
    notes: [],
    enrichment: {
      role: "Solutions Engineer",
      interests: ["cloud infra"],
      recent_activity: [
        { fact: "Organized a campus workshop on cloud infra.", source_url: "https://vultr.com/events/campus-hackathon-workshop", date: null },
      ],
      links: {},
    },
    warmth: 0.35,
    last_touch: "2026-08-10T10:00:00Z",
  },
  {
    id: "seed-6",
    owner_id: "dev-user-1",
    person: { name: "Jordan Lee", org: "CMU Robotics Club", links: {} },
    met: { context_type: "club", place_label: "Club fair" },
    notes: [],
    enrichment: null,
    warmth: 0.25,
    last_touch: "2026-07-28T10:00:00Z",
  },
  {
    id: "seed-7",
    owner_id: "dev-user-1",
    person: { name: "Riley Park", org: "Orientation Group 4", links: {} },
    met: { context_type: "orientation", place_label: "Orientation" },
    notes: [],
    enrichment: null,
    warmth: 0.2,
    last_touch: "2026-07-15T10:00:00Z",
  },
  {
    id: "seed-8",
    owner_id: "dev-user-1",
    person: { name: "Sam Torres", org: "Unknown", links: {} },
    met: { context_type: "other", place_label: "Coffee shop" },
    notes: [],
    enrichment: null,
    warmth: 0.2,
    last_touch: "2026-06-30T10:00:00Z",
  },
];
