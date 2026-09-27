import { PERMISSIONS } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { getWhatsAppStatus, getWhatsAppTemplates } from "@/lib/services/whatsapp";
import { WhatsAppSettingsView } from "./whatsapp-settings-view";

export const metadata = { title: "WhatsApp Gateway Settings" };

export default async function WhatsAppSettingsPage() {
  await requirePermission(PERMISSIONS.SETTINGS_MANAGE);

  const [statusData, templates] = await Promise.all([
    getWhatsAppStatus({ forceRefresh: true }),
    getWhatsAppTemplates(),
  ]);

  return <WhatsAppSettingsView initialStatusData={statusData} templates={templates} />;
}
