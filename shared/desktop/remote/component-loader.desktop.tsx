/// <reference types="webpack-env" />
// Loads a remote component. Receives props from the main window via IPC.
import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import * as Kb from '@/common-adapters'
import * as R from '@/constants/remote'
import * as RemoteGen from '@/constants/remote-actions'
import {GlobalKeyEventHandler} from '@/common-adapters/key-event-handler.desktop'
import {disableDragDrop} from '@/util/drag-drop.desktop'
import ErrorBoundary from '@/common-adapters/error-boundary'
import {initDesktopStyles} from '@/styles/index.desktop'
import KB2 from '@/util/electron.desktop'
import {setServiceDecoration} from '@/common-adapters/markdown/react'
import ServiceDecoration from '@/common-adapters/markdown/service-decoration'

setServiceDecoration(ServiceDecoration)

const {closeWindow, showInactive, ipcRendererOn} = KB2.functions

disableDragDrop()
module.hot?.accept()

type RemoteComponents = 'unlock-folders' | 'menubar' | 'pinentry' | 'tracker'

type Props<P> = {
  child: (p: P) => React.ReactNode
  name: RemoteComponents
  params: string
  showOnProps: boolean
  style?: Kb.Styles.StylesCrossPlatform
}

function RemoteComponentLoader<P>(p: Props<P>) {
  const {name, params, showOnProps} = p
  const [value, setValue] = React.useState<P | null>(null)

  React.useEffect(() => {
    ipcRendererOn?.('KBprops', (_event: unknown, raw: unknown) => {
      const str = raw as string
      const parsed = JSON.parse(str) as P
      setTimeout(() => setValue(parsed), 1)
    })
    R.remoteDispatch(
      RemoteGen.createRemoteWindowWantsProps({component: name, param: params})
    )
  }, [name, params])

  React.useEffect(() => {
    if (value && showOnProps) {
      showInactive?.()
    }
  }, [value, showOnProps])

  if (!value) return null

  return (
    <div id="RemoteComponentRoot" style={Kb.Styles.collapseStylesDesktop([p.style ?? styles.container])}>
      <ErrorBoundary closeOnClick={closeWindow} fallbackStyle={styles.errorFallback}>
        <GlobalKeyEventHandler>
          {p.child(value)}
        </GlobalKeyEventHandler>
      </ErrorBoundary>
    </div>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.white,
          display: 'block' as const,
          height: '100%',
          overflow: 'hidden',
          width: '100%',
        },
      }),
      errorFallback: {backgroundColor: Kb.Styles.globalColors.white},
    }) as const
)

export default function Loader<P>(options: {
  child: (p: P) => React.ReactNode
  name: RemoteComponents
  params?: string
  style?: Kb.Styles.StylesCrossPlatform
  showOnProps?: boolean
}) {
  initDesktopStyles()
  const node = document.getElementById('root')
  if (node) {
    ReactDOM.createRoot(node).render(
      <RemoteComponentLoader<P>
        name={options.name}
        params={options.params || ''}
        style={options.style}
        showOnProps={options.showOnProps ?? true}
        child={options.child}
      />
    )
  }
}
