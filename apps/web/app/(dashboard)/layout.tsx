import { Nav } from "../../components/dashboard/Nav";
import { AuthGate } from "../../components/dashboard/AuthGate";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div>
        <Nav />
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </AuthGate>
  );
}
