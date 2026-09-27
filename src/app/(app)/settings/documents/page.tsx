import { PageHeader } from "@/components/shared/page-header";
import { DocumentSettingsView } from "@/app/(app)/settings/documents/document-settings-view";
import { getCompanyProfile } from "@/lib/pdf/pdf-builder";
import { PERMISSIONS } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";

export const metadata = { title: "Document & PDF Settings | AURCLEAN" };

export default async function SettingsDocumentsPage() {
  await requirePermission([PERMISSIONS.SETTINGS_MANAGE]);
  const initialSettings = await getCompanyProfile();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document & PDF Branding"
        description="Customize headers, company profile, GSTIN, prefixes, terms & conditions, and footers for generated PDFs."
      />
      <DocumentSettingsView initialSettings={initialSettings} />
    </div>
  );
}
