/**
 * Seed 10,000 employees with realistic, deterministic salary data.
 *
 * Determinism matters: a fixed RNG seed means the same data every run, so tests and demos
 * are reproducible. Salaries are derived from level base + country cost factor + jitter,
 * so aggregations (avg by country, pay bands) come out sensibly.
 */

import { PrismaClient } from "@prisma/client";
import {
  COUNTRIES,
  DEPARTMENTS,
  LEVEL_BASE_USD,
  fxRates,
  type Level,
} from "../src/lib/reference";

const prisma = new PrismaClient();

// --- Deterministic RNG (mulberry32) ---------------------------------------
function makeRng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(42);

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Region-appropriate name pools — employees get names matching their country.
type NamePool = { first: string[]; last: string[] };

const NAMES_BY_COUNTRY: Record<string, NamePool> = {
  "United States": {
    first: ["James", "Michael", "Robert", "David", "William", "Ethan", "Tyler", "Brandon", "Matthew", "Joshua",
            "Mary", "Jennifer", "Linda", "Elizabeth", "Emily", "Madison", "Ashley", "Sarah", "Jessica", "Amanda"],
    last: ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Garcia", "Rodriguez", "Wilson",
           "Martinez", "Anderson", "Taylor", "Thomas", "Moore", "Jackson"],
  },
  "United Kingdom": {
    first: ["Oliver", "George", "Harry", "Jack", "Charlie", "Oscar", "Alfie", "Archie", "Henry", "Thomas",
            "Amelia", "Olivia", "Isla", "Emily", "Poppy", "Freya", "Grace", "Sophie", "Charlotte", "Daisy"],
    last: ["Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Evans", "Thomas", "Roberts", "Walker",
           "Wright", "Thompson", "White", "Hughes", "Green", "Hall"],
  },
  Germany: {
    first: ["Lukas", "Leon", "Finn", "Jonas", "Paul", "Felix", "Maximilian", "Moritz", "Niklas", "Tim",
            "Emma", "Mia", "Hannah", "Lena", "Anna", "Lea", "Sophia", "Marie", "Julia", "Laura"],
    last: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann",
           "Koch", "Bauer", "Richter", "Klein", "Wolf", "Schröder"],
  },
  India: {
    first: ["Aarav", "Vivaan", "Aditya", "Arjun", "Rohan", "Karthik", "Rahul", "Amit", "Suresh", "Vikram",
            "Priya", "Ananya", "Diya", "Ishita", "Kavya", "Sneha", "Pooja", "Neha", "Meera", "Lakshmi"],
    last: ["Sharma", "Patel", "Reddy", "Iyer", "Gupta", "Singh", "Kumar", "Nair", "Menon", "Joshi",
           "Desai", "Chopra", "Banerjee", "Rao", "Verma", "Mehta"],
  },
  Canada: {
    first: ["Liam", "Noah", "Logan", "Lucas", "Jacob", "Nathan", "Samuel", "Gabriel", "Ryan", "Owen",
            "Emma", "Olivia", "Sophia", "Charlotte", "Chloe", "Émilie", "Léa", "Zoé", "Abigail", "Hannah"],
    last: ["Smith", "Brown", "Tremblay", "Martin", "Roy", "Wilson", "MacDonald", "Gagnon", "Johnson", "Taylor",
           "Campbell", "Anderson", "Leblanc", "Côté", "Stewart", "Ross"],
  },
  Australia: {
    first: ["Jack", "William", "Noah", "Thomas", "Lachlan", "Cooper", "Ethan", "Lucas", "Harrison", "Riley",
            "Charlotte", "Olivia", "Amelia", "Mia", "Ruby", "Sienna", "Isla", "Grace", "Zoe", "Chloe"],
    last: ["Smith", "Jones", "Williams", "Brown", "Wilson", "Taylor", "Nguyen", "Martin", "Thompson", "White",
           "Walker", "Harris", "Kelly", "King", "Ryan", "O'Brien"],
  },
  Singapore: {
    first: ["Wei Ming", "Jun Jie", "Kai Xiang", "Zhi Hao", "Marcus", "Ryan", "Arjun", "Ravi", "Muhammad Danish", "Irfan",
            "Mei Ling", "Xin Yi", "Hui Wen", "Jia Hui", "Chloe", "Cheryl", "Priya", "Kavya", "Nur Aisyah", "Amirah"],
    last: ["Tan", "Lim", "Lee", "Ng", "Wong", "Chua", "Goh", "Ong", "Teo", "Koh",
           "Sim", "Chen", "Kumar", "Singh", "Abdullah", "Rahman"],
  },
  Brazil: {
    first: ["Miguel", "Arthur", "Gabriel", "Bernardo", "Lucas", "João", "Pedro", "Matheus", "Rafael", "Gustavo",
            "Alice", "Sophia", "Helena", "Valentina", "Laura", "Isabella", "Maria", "Ana", "Beatriz", "Larissa"],
    last: ["Silva", "Santos", "Oliveira", "Souza", "Costa", "Ferreira", "Almeida", "Pereira", "Lima", "Gomes",
           "Ribeiro", "Carvalho", "Rocha", "Martins", "Barbosa", "Araújo"],
  },
};

/** Make a name email-safe: strip accents/apostrophes/spaces ("Wei Ming Müller" -> "weiming.muller"). */
function emailSlug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

const TITLES_BY_LEVEL: Record<Level, string[]> = {
  L1: ["Associate", "Junior Analyst", "Coordinator"],
  L2: ["Analyst", "Specialist", "Engineer I"],
  L3: ["Senior Analyst", "Engineer II", "Manager"],
  L4: ["Lead", "Senior Manager", "Principal"],
  L5: ["Director", "VP", "Head"],
};

// Level distribution — pyramid: many juniors, few execs.
const LEVEL_WEIGHTS: [Level, number][] = [
  ["L1", 0.30],
  ["L2", 0.30],
  ["L3", 0.25],
  ["L4", 0.10],
  ["L5", 0.05],
];

function pickLevel(): Level {
  const r = rng();
  let cum = 0;
  for (const [lvl, w] of LEVEL_WEIGHTS) {
    cum += w;
    if (r <= cum) return lvl;
  }
  return "L1";
}

/** Salary in local currency: USD base * jitter * costFactor * fx. */
function computeSalary(level: Level, costFactor: number, currency: string): number {
  const baseUsd = LEVEL_BASE_USD[level];
  const jitter = 0.85 + rng() * 0.3; // ±15%
  const localUsd = baseUsd * jitter * costFactor;
  // convert USD -> local currency using the same static rates as the app
  const local = localUsd * fxRates[currency];
  return Math.round(local / 100) * 100; // round to nearest 100
}

const TOTAL = 10_000;

async function main() {
  console.log("Clearing existing data…");
  await prisma.auditLog.deleteMany();
  await prisma.salaryRecord.deleteMany();
  await prisma.employee.deleteMany();

  console.log(`Seeding ${TOTAL} employees…`);
  const startYear = 2015;

  for (let batchStart = 0; batchStart < TOTAL; batchStart += 500) {
    const batch = Math.min(500, TOTAL - batchStart);
    const employeesData = [];
    const salariesForBatch: { idx: number; level: Level; country: (typeof COUNTRIES)[number] }[] = [];

    for (let i = 0; i < batch; i++) {
      const globalIdx = batchStart + i;
      const country = pick(COUNTRIES);
      const department = pick(DEPARTMENTS);
      const level = pickLevel();
      const pool = NAMES_BY_COUNTRY[country.name];
      const first = pick(pool.first);
      const last = pick(pool.last);
      const year = startYear + Math.floor(rng() * 10);
      const month = 1 + Math.floor(rng() * 12);
      const day = 1 + Math.floor(rng() * 28);

      employeesData.push({
        name: `${first} ${last}`,
        email: `${emailSlug(first)}.${emailSlug(last)}.${globalIdx}@acme.com`,
        country: country.name,
        department,
        jobTitle: pick(TITLES_BY_LEVEL[level]),
        level,
        hireDate: new Date(Date.UTC(year, month - 1, day)),
      });
      salariesForBatch.push({ idx: i, level, country });
    }

    await prisma.employee.createMany({ data: employeesData });

    // Fetch the ids just inserted (ordered by createdAt then email is unstable across batches;
    // instead re-read by the unique emails we generated).
    const emails = employeesData.map((e) => e.email);
    const created = await prisma.employee.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true },
    });
    const idByEmail = new Map(created.map((c) => [c.email, c.id]));

    const salaryData = employeesData.map((emp, i) => {
      const { level, country } = salariesForBatch[i];
      return {
        employeeId: idByEmail.get(emp.email)!,
        amount: computeSalary(level, country.costFactor, country.currency),
        currency: country.currency,
        effectiveDate: emp.hireDate,
        isCurrent: true,
      };
    });
    await prisma.salaryRecord.createMany({ data: salaryData });

    console.log(`  …${batchStart + batch}/${TOTAL}`);
  }

  const count = await prisma.employee.count();
  console.log(`Done. ${count} employees seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
