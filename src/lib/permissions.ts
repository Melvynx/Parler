import { commands } from "@/bindings";
import { checkAccessibilityPermission } from "tauri-plugin-macos-permissions-api";

// Polling-safe check: only reads the TCC database, never calls initializeEnigo.
// Enigo::new() triggers a system prompt on every call when access is missing,
// so using it here would spam the user once per polling tick.
export const checkMacOSAccessibilityReady = async (): Promise<boolean> => {
  try {
    return await checkAccessibilityPermission();
  } catch (error) {
    console.warn("Failed to query macOS accessibility permission:", error);
    return false;
  }
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
