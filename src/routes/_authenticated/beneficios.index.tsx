import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/beneficios/")({
  beforeLoad: () => {
    throw redirect({ to: "/beneficios/clientes" });
  },
});
