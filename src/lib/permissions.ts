import { commands } from "@/bindings";
import { checkAccessibilityPermission } from "tauri-plugin-macos-permissions-api";

export const checkMacOSAccessibilityReady = async (): Promise<boolean> => {
  try {
    if (await checkAccessibilityPermission()) {
      return true;
    }
  } catch (error) {
    console.warn("Failed to query macOS accessibility permission:", error);
  }

  const enigoResult = await commands.initializeEnigo();
  return enigoResult.status === "ok";
};

export const initializeMacOSAccessibilitySystems = async (): Promise<void> => {
  const enigoResult = await commands.initializeEnigo();
  if (enigoResult.status === "error") {
    throw new Error(enigoResult.error);
  }

  const shortcutsResult = await commands.initializeShortcuts();
  if (shortcutsResult.status === "error") {
    throw new Error(shortcutsResult.error);
  }
};
