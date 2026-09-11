import { Nav } from "../../components/dashboard/Nav";
import { AuthGate } from "../../components/dashboard/AuthGate";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div style={{ background: "#111", color: "#eee", minHeight: "100vh" }}>
        <Nav />
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </AuthGate>
  );
}
