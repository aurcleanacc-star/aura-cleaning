import { Suspense } from "react";
import Link from "next/link";
import {
  FileText,
  Search,
  Filter,
  Plus,
  Truck,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Printer,
  Send,
} from "lucide-react";

import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import { getDeliveryChallans, getChallanStats } from "@/lib/services/delivery-challan";
import { formatCurrency } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ChallanStatus, PaymentStatus } from "@/generated/prisma/client";

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    paymentStatus?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}

export const metadata = {
  title: "Delivery Challans — AURCLEAN Laundry ERP",
  description: "Manage, track, generate, and print official Delivery Challans.",
};

export default async function DeliveryChallansPage({ searchParams }: PageProps) {
  const session = await requirePermission(PERMISSIONS.DELIVERY_VIEW);
  const resolvedParams = await searchParams;

  const page = parseInt(resolvedParams.page || "1", 10);
  const search = resolvedParams.search || "";
  const status = (resolvedParams.status || "ALL") as ChallanStatus | "ALL";
  const paymentStatus = (resolvedParams.paymentStatus || "ALL") as PaymentStatus | "ALL";

  const branchId = session.role === "SUPER_ADMIN" ? undefined : session.branchId || undefined;

  const [{ challans, pagination }, stats] = await Promise.all([
    getDeliveryChallans({
      page,
      limit: 15,
      search,
      status,
      paymentStatus,
      branchId,
    }),
    getChallanStats(branchId),
  ]);

  return (
    <div className="space-y-6 p-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-7 h-7 text-emerald-700" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Delivery Challans</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Official delivery documentation, partial delivery tracking, and customer dispatch records.
          </p>
        </div>

        <Link href="/orders">
          <Button className="bg-emerald-700 hover:bg-emerald-800 text-white gap-2 shadow-sm">
            <Plus className="w-4 h-4" /> Create Challan from Order
          </Button>
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Today's Challans</p>
            <p className="text-xl font-bold text-slate-900">{stats.todaysChallans}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Pending Delivery</p>
            <p className="text-xl font-bold text-amber-700">{stats.pendingDelivery}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Partially Delivered</p>
            <p className="text-xl font-bold text-indigo-700">{stats.partiallyDelivered}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">Delivered Today</p>
            <p className="text-xl font-bold text-emerald-700">{stats.deliveredToday}</p>
          </div>
        </div>
      </div>

      {/* Search & Filtering Form */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <form method="GET" className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <div className="relative col-span-1 sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <Input
              name="search"
              defaultValue={search}
              placeholder="Search Challan #, Order #, Customer Name, Phone..."
              className="pl-9"
            />
          </div>

          <div>
            <select
              name="status"
              defaultValue={status}
              className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="ALL">All Challan Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="GENERATED">Generated</option>
              <option value="READY_FOR_DELIVERY">Ready for Delivery</option>
              <option value="PARTIALLY_DELIVERED">Partially Delivered</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="flex gap-2">
            <select
              name="paymentStatus"
              defaultValue={paymentStatus}
              className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="ALL">All Payment Statuses</option>
              <option value="UNPAID">Unpaid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
            </select>
            <Button type="submit" variant="secondary" className="gap-1">
              <Filter className="w-4 h-4" /> Filter
            </Button>
          </div>
        </form>
      </div>

      {/* Delivery Challans Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {challans.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800">No Delivery Challans Found</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              No delivery challans match your search query or filter parameters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Challan No</th>
                  <th className="py-3 px-4">Order No</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4 text-center">Items</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-center">Payment</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {challans.map((dc: any) => {
                  const statusColors: Record<string, string> = {
                    DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
                    GENERATED: "bg-blue-50 text-blue-700 border-blue-200",
                    READY_FOR_DELIVERY: "bg-amber-50 text-amber-800 border-amber-200",
                    PARTIALLY_DELIVERED: "bg-indigo-50 text-indigo-700 border-indigo-200",
                    DELIVERED: "bg-emerald-50 text-emerald-800 border-emerald-200",
                    CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
                  };

                  const paymentColors: Record<string, string> = {
                    UNPAID: "bg-rose-50 text-rose-700 border-rose-200",
                    PARTIALLY_PAID: "bg-amber-50 text-amber-800 border-amber-200",
                    PAID: "bg-emerald-50 text-emerald-800 border-emerald-200",
                  };

                  return (
                    <tr key={dc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-emerald-800">
                        <Link href={`/delivery-challans/${dc.id}`} className="hover:underline">
                          {dc.challanNumber}
                        </Link>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-800">
                        <Link href={`/orders/${dc.order.id}`} className="hover:underline font-medium">
                          {dc.order.orderNumber}
                        </Link>
                      </td>

                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{dc.customerName}</p>
                        <p className="text-xs text-slate-500">{dc.customerPhone}</p>
                      </td>

                      <td className="py-3 px-4 text-center font-bold text-slate-800">
                        {dc.items.length}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(Number(dc.grandTotal))}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${paymentColors[dc.paymentStatus] || "bg-slate-100"}`}>
                          {dc.paymentStatus}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wider ${statusColors[dc.status] || "bg-slate-100"}`}>
                          {dc.status.replace(/_/g, " ")}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs text-slate-600">
                        {formatDate(dc.challanDate)}
                      </td>

                      <td className="py-3 px-4 text-right space-x-1">
                        <Link href={`/delivery-challans/${dc.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="View Details">
                            <Eye className="w-4 h-4 text-slate-600" />
                          </Button>
                        </Link>
                        <Link href={`/delivery-challans/${dc.id}/print`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Print Challan">
                            <Printer className="w-4 h-4 text-slate-600" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.pages > 1 && (
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} challans
            </span>
            <div className="flex gap-1">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/delivery-challans?page=${p}&search=${encodeURIComponent(search)}&status=${status}&paymentStatus=${paymentStatus}`}
                >
                  <Button
                    variant={p === pagination.page ? "default" : "outline"}
                    size="sm"
                    className={`h-7 w-7 p-0 text-xs ${p === pagination.page ? "bg-emerald-700 text-white" : ""}`}
                  >
                    {p}
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
