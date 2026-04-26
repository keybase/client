// This hook creates a remote brower window when mounted
import * as React from 'react'
import KB2 from '@/util/electron.desktop'
import type {RemoteComponentName} from './remote-component.desktop'

const {makeRenderer, closeRenderer} = KB2.functions

export type UseBrowserOptions = {
  windowOpts: {
    hasShadow?: boolean | undefined
    height: number
    transparent?: boolean | undefined
    width: number
  }
  windowPositionBottomRight?: true | undefined
  windowComponent?: RemoteComponentName | undefined // undefined to kill the browserwindow
  windowTitle: string
  windowParam?: string | undefined
}

function useBrowserWindow(options: UseBrowserOptions) {
  const {windowOpts, windowComponent, windowParam, windowPositionBottomRight} = options
  React.useEffect(() => {
    if (windowComponent) {
      makeRenderer?.({
        windowComponent,
        windowOpts,
        ...(windowParam === undefined ? {} : {windowParam}),
        ...(windowPositionBottomRight === undefined ? {} : {windowPositionBottomRight}),
      })
    }
    return () => {
      closeRenderer?.({
        ...(windowComponent === undefined ? {} : {windowComponent}),
        ...(windowParam === undefined ? {} : {windowParam}),
      })
    }
  }, [windowComponent, windowParam, windowOpts, windowPositionBottomRight])
}

export default useBrowserWindow
