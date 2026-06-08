export const maxHandshakeTries = 3
export const maxUsernameLength = 16

// Exit Codes
export const ExitCodeFuseKextError = 4
export const ExitCodeFuseKextPermissionError = 5
export const ExitCodeAuthCanceledError = 6
// See Installer.m: KBExitFuseCriticalUpdate
export const ExitFuseCriticalUpdate = 8
// See install_darwin.go: exitCodeFuseCriticalUpdateFailed
export const ExitFuseCriticalUpdateFailed = 300
