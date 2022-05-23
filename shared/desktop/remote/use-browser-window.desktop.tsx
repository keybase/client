// This hook creates a remote brower window when mounted
import * as React from 'react'
import KB2 from '../../util/electron.desktop'

const {makeRenderer, closeRenderer} = KB2.functions

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
      makeRenderer?.({
        windowComponent,
        windowOpts,
        windowParam,
        windowPositionBottomRight,
      })
    }
    return () => {
      closeRenderer?.({windowComponent, windowParam})
    }
  }, [windowComponent, windowParam, windowOpts, windowPositionBottomRight])
}

export default useBrowserWindow
