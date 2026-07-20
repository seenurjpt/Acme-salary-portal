/** Zod schemas validating API input for employee mutations. */

import { z } from "zod";
import { DEPARTMENTS, LEVELS, COUNTRIES, CURRENCIES } from "./reference";

const COUNTRY_NAMES = COUNTRIES.map((c) => c.name) as [string, ...string[]];

export const createEmployeeSchema = z.object({
  name: z.string().min(1, "Name is required").max(120),
  email: z.string().email("Valid email required"),
  country: z.enum(COUNTRY_NAMES),
  department: z.enum(DEPARTMENTS),
  jobTitle: z.string().min(1).max(120),
  level: z.enum(LEVELS),
  hireDate: z.coerce.date(),
  salary: z.number().positive("Salary must be positive"),
  currency: z.enum(CURRENCIES as [string, ...string[]]),
});

export const updateEmployeeSchema = createEmployeeSchema.partial();

export const askSchema = z.object({
  question: z.string().min(1).max(500),
});
