// This loads up a remote component. It makes a pass-through store which accepts its props from the main window through ipc
// Also protects it with an error boundary
import * as React from 'react'
import * as SafeElectron from '../../util/safe-electron.desktop'
import * as Styles from '../../styles'
import ReactDOM from 'react-dom'
import RemoteStore from './store.desktop'
import Root from '../renderer/container.desktop'
import {disable as disableDragDrop} from '../../util/drag-drop'
import {setupContextMenu} from '../app/menu-helper.desktop'
import ErrorBoundary from '../../common-adapters/error-boundary'
import {initDesktopStyles} from '../../styles/index.desktop'

disableDragDrop()

module.hot && module.hot.accept()

type RemoteComponents = 'unlock-folders' | 'menubar' | 'pinentry' | 'tracker' | 'tracker2'

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
  _window: SafeElectron.BrowserWindowType | null

  constructor(props) {
    super(props)
    this._window = SafeElectron.getRemote().getCurrentWindow()
    const remoteStore = new RemoteStore({
      deserialize: props.deserialize,
      gotPropsCallback: this._onGotProps,
      windowComponent: props.name,
      windowParam: props.params,
    })
    this._store = remoteStore.getStore()
    setupContextMenu(this._window)
  }

  _onGotProps = () => {
    // Show when we get props, unless its the menubar
    if (this._window && this.props.showOnProps) {
      this._window.showInactive()
    }
  }

  _onClose = () => {
    if (this._window) {
      this._window.close()
    }
  }

  render() {
    return (
      <div id="RemoteComponentRoot" style={this.props.style || styles.container}>
        <ErrorBoundary closeOnClick={this._onClose}>
          <Root store={this._store}>{this.props.children}</Root>
        </ErrorBoundary>
      </div>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.white,
      display: 'block' as const,
      height: '100%',
      overflow: 'hidden',
      width: '100%',
    },
  }),
  loading: {
    backgroundColor: Styles.globalColors.greyDark,
  },
})

export default function(options: {
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
    ReactDOM.render(
      <RemoteComponentLoader
        name={options.name}
        params={options.params || ''}
        style={options.style || null}
        showOnProps={
          // Auto generated from flowToTs. Please clean me!
          options.showOnProps !== null && options.showOnProps !== undefined ? options.showOnProps : true
        }
        deserialize={options.deserialize}
      >
        {options.child}
      </RemoteComponentLoader>,
      node
    )
  }
}
