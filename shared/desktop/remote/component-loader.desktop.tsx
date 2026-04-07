/// <reference types="webpack-env" />
// Loads a remote component. Receives props from the main window via IPC.
import type * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import * as Kb from '@/common-adapters'
import {GlobalKeyEventHandler} from '@/common-adapters/key-event-handler.desktop'
import {disableDragDrop} from '@/util/drag-drop.desktop'
import ErrorBoundary from '@/common-adapters/error-boundary'
import {initDesktopStyles} from '@/styles/index.desktop'
import KB2 from '@/util/electron.desktop'
import {setServiceDecoration} from '@/common-adapters/markdown/react'
import ServiceDecoration from '@/common-adapters/markdown/service-decoration'
import {type RemoteComponentName, useRemotePropsReceiver} from './remote-component.desktop'

setServiceDecoration(ServiceDecoration)

const {closeWindow} = KB2.functions

disableDragDrop()
module.hot?.accept()

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
          height: '100%',
          overflow: 'hidden',
          width: '100%',
        },
      }),
      errorFallback: {backgroundColor: Kb.Styles.globalColors.white},
    }) as const
)

export default function loadRemoteComponent<P>(options: {
  Component: React.ComponentType<P>
  component: RemoteComponentName
  param?: string
  style?: Kb.Styles.StylesCrossPlatform
  showOnProps?: boolean
}) {
  initDesktopStyles()
  const node = document.getElementById('root')
  if (node) {
    ReactDOM.createRoot(node).render(
      <RemoteComponentLoader<P>
        Component={options.Component}
        component={options.component}
        param={options.param ?? ''}
        style={options.style}
        showOnProps={options.showOnProps ?? true}
      />
    )
  }
}
