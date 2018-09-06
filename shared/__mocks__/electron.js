// @noflow
if (!__STORYBOOK__) {
  throw new Error('Invalid load of mock')
}

// Does not fully mock members
// Add properties & functions as necessary
export const clipboard = {writeText: s => {}}
export const remote = {
  BrowserWindow: {},
  Menu: {},
  getCurrentWindow: () => ({
    on: () => {},
  }),
}
export const crashReporter = {}
export const shell = {openExternal: () => {}}
export const ipcRenderer = {}
export const globalShortcut = {}
export const session = {}
export const dialog = {}
export const systemPreferences = {}
export const ipcMain = {}
export const app = {}
export const screen = {}

export const BrowserWindow = {}
export const Menu = {}
