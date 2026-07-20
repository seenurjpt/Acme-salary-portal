import { Shell } from "@/components/nav";
import { EmployeesClient } from "./EmployeesClient";
import { COUNTRIES, DEPARTMENTS, LEVELS, CURRENCIES } from "@/lib/reference";

export default function EmployeesPage() {
  return (
    <Shell>
      <EmployeesClient
        countries={COUNTRIES.map((c) => c.name)}
        departments={[...DEPARTMENTS]}
        levels={[...LEVELS]}
        currencies={CURRENCIES}
      />
    </Shell>
  );
}
