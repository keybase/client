// This loads up a remote component. It makes a pass-through store which accepts its props from the main window through ipc
// Also protects it with an error boundary
import * as React from 'react'
import * as ReactDOM from 'react-dom/client'
import * as Kb from '@/common-adapters'
import {Provider} from 'react-redux'
import RemoteStore from './store.desktop'
import Root from '../renderer/container.desktop'
import {disableDragDrop} from '@/util/drag-drop.desktop'
import ErrorBoundary from '@/common-adapters/error-boundary'
import {initDesktopStyles} from '@/styles/index.desktop'
import KB2 from '@/util/electron.desktop'

import {setServiceDecoration} from '@/common-adapters/markdown/react'
import ServiceDecoration from '@/common-adapters/markdown/service-decoration'
setServiceDecoration(ServiceDecoration)

const {closeWindow, showInactive} = KB2.functions

disableDragDrop()

module.hot?.accept()

type RemoteComponents = 'unlock-folders' | 'menubar' | 'pinentry' | 'tracker2'

type Props = {
  children: React.ReactNode
  deserialize: (arg0: any, arg1: any) => any
  name: RemoteComponents
  params: string
  showOnProps: boolean
  style?: Kb.Styles.StylesDesktop
}

class RemoteComponentLoader extends React.Component<Props> {
  _store: any

  constructor(props: Props) {
    super(props)
    const remoteStore = new RemoteStore({
      deserialize: props.deserialize,
      gotPropsCallback: this._onGotProps,
      windowComponent: props.name,
      windowParam: props.params,
    })
    this._store = remoteStore.getStore()
  }

  _onGotProps = () => {
    // Show when we get props, unless its the menubar
    if (this.props.showOnProps) {
      showInactive?.()
    }
  }

  render() {
    return (
      <div id="RemoteComponentRoot" style={this.props.style || (styles.container as any)}>
        <ErrorBoundary closeOnClick={closeWindow} fallbackStyle={styles.errorFallback}>
          <Provider store={this._store}>
            <Root>{this.props.children}</Root>
          </Provider>
        </ErrorBoundary>
      </div>
    )
  }
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: Kb.Styles.platformStyles({
    isElectron: {
      backgroundColor: Kb.Styles.globalColors.white,
      display: 'block' as const,
      height: '100%',
      overflow: 'hidden',
      width: '100%',
    },
  }),
  errorFallback: {
    backgroundColor: Kb.Styles.globalColors.white,
  },
  loading: {
    backgroundColor: Kb.Styles.globalColors.greyDark,
  },
}))

export default function Loader(options: {
  child: React.ReactNode
  deserialize: (arg0: any, arg1: any) => any
  name: RemoteComponents
  params?: string
  style?: Kb.Styles.StylesDesktop
  showOnProps?: boolean
}) {
  initDesktopStyles()
  const node = document.getElementById('root')
  if (node) {
    ReactDOM.createRoot(node).render(
      <RemoteComponentLoader
        name={options.name}
        params={options.params || ''}
        style={options.style}
        showOnProps={options.showOnProps ?? true}
        deserialize={options.deserialize}
      >
        {options.child}
      </RemoteComponentLoader>
    )
  }
}
