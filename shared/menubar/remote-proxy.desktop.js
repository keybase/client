// @flow
// A mirror of the remote menubar windows.
import * as React from 'react'
import SyncAvatarProps from '../desktop/remote/sync-avatar-props.desktop'
import SyncProps from '../desktop/remote/sync-props.desktop'
import {sendLoad} from '../desktop/remote/sync-browser-window.desktop'
import {connect, type TypedState, compose, renderNothing, branch} from '../util/container'
import {remote, BrowserWindow} from 'electron'

const windowOpts = {}

type Props = {
  externalRemoteWindow: BrowserWindow,
  windowComponent: string,
  windowOpts?: Object,
  windowParam: string,
  windowPositionBottomRight?: boolean,
  windowTitle: string,
}

// Like RemoteWindow but the browserWindow is handled by the 3rd party menubar class and mostly lets it handle things
function RemoteMenubarWindow(ComposedComponent: any) {
  class RemoteWindowComponent extends React.PureComponent<Props> {
    _sendLoad = () => {
      sendLoad(
        this.props.externalRemoteWindow.webContents,
        this.props.windowParam,
        this.props.windowComponent,
        this.props.windowTitle
      )
    }

    componentWillMount() {
      this._sendLoad()

      // Allow reloads
      this.props.externalRemoteWindow.webContents.on('did-finish-load', this._sendLoad)

      // uncomment to see menubar devtools
      this.props.externalRemoteWindow.webContents.openDevTools('detach')
    }
    render() {
      const {windowOpts, windowPositionBottomRight, windowTitle, externalRemoteWindow, ...props} = this.props
      return <ComposedComponent {...props} remoteWindow={this.props.externalRemoteWindow} />
    }
  }

  return RemoteWindowComponent
}

const mapStateToProps = (state: TypedState) => ({
  _badgeInfo: state.notifications.navBadges,
  _externalRemoteWindowID: state.config.menubarWindowID,
  folderProps: state.favorite.folderState,
  isAsyncWriteHappening: state.favorite.kbfsStatus && state.favorite.kbfsStatus.isAsyncWriteHappening,
  loggedIn: state.config.loggedIn,
  username: state.config.username,
})

const mergeProps = stateProps => ({
  badgeInfo: stateProps._badgeInfo.toJS(),
  externalRemoteWindow: stateProps._externalRemoteWindowID
    ? remote.BrowserWindow.fromId(stateProps._externalRemoteWindowID)
    : null,
  folderProps: stateProps.folderProps,
  isAsyncWriteHappening: stateProps.isAsyncWriteHappening,
  loggedIn: stateProps.loggedIn,
  username: stateProps.username,
  windowComponent: 'menubar',
  windowOpts,
  windowParam: '',
  windowTitle: '',
})

// Actions are handled by remote-container
export default compose(
  connect(mapStateToProps, () => ({}), mergeProps),
  branch(props => !props.externalRemoteWindow, renderNothing),
  RemoteMenubarWindow,
  SyncAvatarProps,
  SyncProps,
  // $FlowIssue gets confused
  renderNothing
)(null)
