/// <reference types="vite/client" />
// Loads a remote component. Receives props from the main window via IPC.
import type * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import * as Kb from '@/common-adapters'
import {GlobalKeyEventHandler} from '@/common-adapters/key-event-handler.desktop'
import {disableDragDrop} from '@/util/drag-drop.desktop'
import ErrorBoundary from '@/common-adapters/error-boundary'
import KB2 from '@/util/electron'
import {setServiceDecoration} from '@/common-adapters/markdown/react'
import ServiceDecoration from '@/common-adapters/markdown/service-decoration'
import {
  getRemoteComponentParam,
  type RemoteComponentName,
  useRemoteDarkModeSync,
  useRemotePropsReceiver,
} from './remote-component.desktop'

setServiceDecoration(ServiceDecoration)

const {closeWindow} = KB2.functions

disableDragDrop()
import.meta.hot?.accept()

type Props<P> = {
  Component: React.ComponentType<P>
  component: RemoteComponentName
  param: string
  showOnProps: boolean
  style?: Kb.Styles.StylesCrossPlatform
}

function RemoteComponentLoader<P>(p: Props<P>) {
  const {Component, component, param, showOnProps} = p
  const value = useRemotePropsReceiver<P>({component, param, showOnProps})
  useRemoteDarkModeSync(value?.darkMode)

  if (!value) return null

  return (
    <Kb.Box2
      direction="vertical"
      fullHeight={true}
      fullWidth={true}
      style={Kb.Styles.collapseStyles([p.style ?? styles.container])}
    >
      <ErrorBoundary closeOnClick={closeWindow} fallbackStyle={styles.errorFallback}>
        <GlobalKeyEventHandler>
          <Component {...value} />
        </GlobalKeyEventHandler>
      </ErrorBoundary>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.white,
          display: 'block' as const,
          ...Kb.Styles.size('100%'),
          overflow: 'hidden',
        },
      }),
      errorFallback: {backgroundColor: Kb.Styles.globalColors.white},
    }) as const
)

export default function loadRemoteComponent<P>(options: {
  Component: React.ComponentType<P>
  component: RemoteComponentName
  style?: Kb.Styles.StylesCrossPlatform
  showOnProps?: boolean
}) {
  Kb.Styles.initDesktopStyles()
  const node = document.getElementById('root')
  if (node) {
    ReactDOM.createRoot(node).render(
      <RemoteComponentLoader<P>
        Component={options.Component}
        component={options.component}
        param={getRemoteComponentParam()}
        style={options.style}
        showOnProps={options.showOnProps ?? true}
      />
    )
  }
}
