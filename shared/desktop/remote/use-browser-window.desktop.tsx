// This hook creates a remote brower window when mounted
import * as React from 'react'
import * as SafeElectron from '../../util/safe-electron.desktop'

export type UseBrowserOptions = {
  windowOpts: Electron.BrowserWindowConstructorOptions
  windowPositionBottomRight?: true
  windowComponent?: string // undefined to kill the browserwindow
  windowTitle: string
  windowParam?: string
}

function useBrowserWindow(options: UseBrowserOptions) {
  const {windowOpts, windowComponent, windowParam, windowPositionBottomRight} = options
  React.useEffect(() => {
    if (windowComponent) {
      // window.open()
      // TODO
      SafeElectron.getApp().emit('KBkeybase', '', {
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
      SafeElectron.getApp().emit('KBkeybase', '', {
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
