// This HOC wraps a component that represents a remote window. When this component is mounted anywhere it'll ask to make a BrowserWindow
import * as React from 'react'
import * as SafeElectron from '../../util/safe-electron.desktop'

type Props = {
  windowOpts: Object
  windowPositionBottomRight: boolean
  windowComponent: string
  windowTitle: string
  windowParam: string
}

function SyncBrowserWindow(ComposedComponent: any) {
  const RemoteWindowComponent = (props: Props) => {
    React.useEffect(() => {
      const {windowOpts, windowComponent, windowParam, windowPositionBottomRight} = props

      SafeElectron.getApp().emit('KBkeybase', '', {
        payload: {
          windowComponent,
          windowOpts,
          windowParam,
          windowPositionBottomRight,
        },
        type: 'makeRenderer',
      })
      return () => {
        SafeElectron.getApp().emit('KBkeybase', '', {
          payload: {
            windowComponent,
            windowParam,
          },
          type: 'closeRenderer',
        })
      }
      // eslint-disable-next-line
    }, []) // we want this on mount/unmount ONLY

    // Don't forward our internal props
    const {windowOpts, windowPositionBottomRight, windowTitle, ...rest} = props
    return <ComposedComponent {...rest} />
  }

  return RemoteWindowComponent
}

export default SyncBrowserWindow
