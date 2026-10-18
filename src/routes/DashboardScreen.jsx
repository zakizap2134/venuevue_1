import { useCallback } from "react";
import AppShell from "../components/AppShell";
import { useAuth } from "../context/AuthContext";
import { DashboardPanel } from "../components/ManagementPanels";
export default function DashboardScreen() {
  const { fetchWithAuth } = useAuth();
  const request = useCallback(
    async (url) => {
      const response = await fetchWithAuth(url, {
        signal: AbortSignal.timeout(15000),
      });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.error ?? "Dashboard unavailable");
      return body;
    },
    [fetchWithAuth],
  );
  return (
    <AppShell>
      <div className="vv-workspace">
        <h1>Management overview</h1>
        <DashboardPanel request={request} />
      </div>
    </AppShell>
  );
}
