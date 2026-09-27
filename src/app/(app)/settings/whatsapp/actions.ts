"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/session";
import { PERMISSIONS } from "@/lib/rbac";
import {
  connectWhatsAppSession,
  disconnectWhatsAppSession,
  getWhatsAppStatus,
  reconnectWhatsAppSession,
  saveWhatsAppTemplate,
  sendWhatsAppMessage,
  type SendWhatsAppParams,
} from "@/lib/services/whatsapp";
import type { WhatsAppMessageType } from "@/generated/prisma/client";

export async function sendWhatsAppAction(params: SendWhatsAppParams) {
  try {
    const user = await requirePermission(PERMISSIONS.ORDER_VIEW);
    const res = await sendWhatsAppMessage({ ...params, sentByUserId: user.id });
    return { ok: true, data: res };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to send WhatsApp message" };
  }
}

export async function connectWhatsAppAction() {
  try {
    await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
    const state = await connectWhatsAppSession();
    revalidatePath("/settings/whatsapp");
    return { ok: true, data: state };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to connect WhatsApp session" };
  }
}

export async function refreshWhatsAppAction() {
  try {
    await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
    const state = await getWhatsAppStatus({ forceRefresh: true });
    revalidatePath("/settings/whatsapp");
    return { ok: true, data: state };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to refresh WhatsApp status" };
  }
}

export async function reconnectWhatsAppAction() {
  try {
    await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
    const state = await reconnectWhatsAppSession();
    revalidatePath("/settings/whatsapp");
    return { ok: true, data: state };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to reconnect WhatsApp session" };
  }
}

export async function disconnectWhatsAppAction() {
  try {
    await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
    const state = await disconnectWhatsAppSession();
    revalidatePath("/settings/whatsapp");
    return { ok: true, data: state };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to disconnect WhatsApp session" };
  }
}

export async function saveTemplateAction(code: WhatsAppMessageType, name: string, body: string) {
  try {
    await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
    const template = await saveWhatsAppTemplate(code, name, body);
    revalidatePath("/settings/whatsapp");
    return { ok: true, data: template };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to save WhatsApp template" };
  }
}
