import { Suspense } from "react";
import { listCreatorOptions } from "@/lib/queries";
import { hasDatabase } from "@/lib/db";
import { NavClient } from "./nav-client";

// Server wrapper: loads the creator options from SQLite and hands them to a
// client child that reads the `?creator=` search param. The Suspense
// boundary is required because NavClient calls `useSearchParams`, which
// would otherwise force every page inside the root layout into CSR bailout.
export function Nav() {
  const creators = hasDatabase() ? listCreatorOptions() : [];
  return (
    <Suspense fallback={null}>
      <NavClient creators={creators} />
    </Suspense>
  );
}
