"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Layers, ScanLine } from "lucide-react";

import { ScanStation } from "./scan-station";
import { BatchScanner } from "./batch-scanner";
import type { ScanHistoryRow } from "@/lib/services/scanning";

interface Props {
  history: ScanHistoryRow[];
  canUpdateStatus: boolean;
  canResolve: boolean;
}

export function ScanContainer({ history, canUpdateStatus, canResolve }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const mode = searchParams.get("mode") === "batch" ? "batch" : "single";

  const handleTabChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (val === "batch") {
      params.set("mode", "batch");
    } else {
      params.delete("mode");
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <Tabs value={mode} onValueChange={handleTabChange} className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 max-w-md h-11 p-1 bg-muted/60">
        <TabsTrigger value="single" className="gap-2 font-medium">
          <ScanLine className="size-4" /> Single Garment Scan
        </TabsTrigger>
        <TabsTrigger value="batch" className="gap-2 font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
          <Layers className="size-4" /> BATCH SCAN
        </TabsTrigger>
      </TabsList>

      <TabsContent value="single" className="space-y-5">
        <ScanStation
          history={history}
          canUpdateStatus={canUpdateStatus}
          canResolve={canResolve}
        />
      </TabsContent>

      <TabsContent value="batch" className="space-y-5">
        <BatchScanner />
      </TabsContent>
    </Tabs>
  );
}
