import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="min-h-screen text-white" style={{ background: "#14405C" }}>
      <Outlet />
    </div>
  );
}
