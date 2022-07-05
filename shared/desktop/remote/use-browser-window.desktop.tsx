// This hook creates a remote brower window when mounted
import * as React from 'react'
import * as Electron from 'electron'

export type UseBrowserOptions = {
  windowOpts: {
    hasShadow?: boolean
    height: number
    transparent?: boolean
    width: number
  }
  windowPositionBottomRight?: true
  windowComponent?: string // undefined to kill the browserwindow
  windowTitle: string
  windowParam?: string
}

function useBrowserWindow(options: UseBrowserOptions) {
  const {windowOpts, windowComponent, windowParam, windowPositionBottomRight} = options
  React.useEffect(() => {
    if (windowComponent) {
      Electron.ipcRenderer.invoke('KBkeybase', {
        payload: {
          windowComponent,
          windowOpts,
          windowParam,
          windowPositionBottomRight,
        },
        type: 'makeRenderer',
      })
    }
    return () => {
      Electron.ipcRenderer.invoke('KBkeybase', {
        payload: {
          windowComponent,
          windowParam,
        },
        type: 'closeRenderer',
      })
    }
  }, [windowComponent, windowParam, windowOpts, windowPositionBottomRight])
}

export default useBrowserWindow
