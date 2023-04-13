// This loads up a remote component. It makes a pass-through store which accepts its props from the main window through ipc
// Also protects it with an error boundary
import * as React from 'react'
import * as Styles from '../../styles'
import * as ReactDOM from 'react-dom/client'
import RemoteStore from './store.desktop'
import Root from '../renderer/container.desktop'
import {disableDragDrop} from '../../util/drag-drop.desktop'
import ErrorBoundary from '../../common-adapters/error-boundary'
import {initDesktopStyles} from '../../styles/index.desktop'
import {enableMapSet} from 'immer'
import KB2 from '../../util/electron.desktop'

const {closeWindow, showInactive} = KB2.functions

enableMapSet()
disableDragDrop()

module.hot?.accept()

type RemoteComponents = 'unlock-folders' | 'menubar' | 'pinentry' | 'tracker2'

type Props = {
  children: React.ReactNode
  deserialize: (arg0: any, arg1: any) => any
  name: RemoteComponents
  params: string
  showOnProps: boolean
  style: Styles.StylesDesktop | null
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
          <Root store={this._store}>{this.props.children}</Root>
        </ErrorBoundary>
      </div>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.white,
      display: 'block' as const,
      height: '100%',
      overflow: 'hidden',
      width: '100%',
    },
  }),
  errorFallback: {
    backgroundColor: Styles.globalColors.white,
  },
  loading: {
    backgroundColor: Styles.globalColors.greyDark,
  },
}))

export default function (options: {
  child: React.ReactNode
  deserialize: (arg0: any, arg1: any) => any
  name: RemoteComponents
  params?: string
  style?: Styles.StylesDesktop
  showOnProps?: boolean
}) {
  initDesktopStyles()
  const node = document.getElementById('root')
  if (node) {
    ReactDOM.createRoot(node).render(
      <RemoteComponentLoader
        name={options.name}
        params={options.params || ''}
        style={options.style || null}
        showOnProps={options.showOnProps ?? true}
        deserialize={options.deserialize}
      >
        {options.child}
      </RemoteComponentLoader>
    )
  }
}
