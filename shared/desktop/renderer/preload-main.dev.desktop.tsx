import url from 'url'
import events from 'events'
import * as Electron from 'electron'
import './preload-main.shared.desktop'
// dev only, needed by dev server

window.KB = {
  ...window.KB,
  DEV: {
    events,
    url,
    toggleDevTools: (enable: boolean) => {
      Electron.BrowserWindow.getAllWindows().map(bw =>
        enable ? bw.webContents.openDevTools({mode: 'detach'}) : bw.webContents.closeDevTools()
      )
    },
  },
}
