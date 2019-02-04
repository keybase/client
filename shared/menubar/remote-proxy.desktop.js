// @flow
// A mirror of the remote menubar windows.
import * as React from 'react'
import SyncAvatarProps from '../desktop/remote/sync-avatar-props.desktop'
import SyncProps from '../desktop/remote/sync-props.desktop'
import {NullComponent, namedConnect} from '../util/container'
import * as SafeElectron from '../util/safe-electron.desktop'
import {conversationsToSend} from '../chat/inbox/container/remote'
import {serialize} from './remote-serializer.desktop'
import {uploadsToUploadCountdownHOCProps} from '../fs/footer/upload-container'

const windowOpts = {}

type Props = {
  externalRemoteWindow: SafeElectron.BrowserWindowType,
  windowComponent: string,
  windowOpts?: Object,
  windowParam: string,
  windowPositionBottomRight?: boolean,
  windowTitle: string,
}

// Like RemoteWindow but the browserWindow is handled by the 3rd party menubar class and mostly lets it handle things
function RemoteMenubarWindow(ComposedComponent: any) {
  class RemoteWindowComponent extends React.PureComponent<Props> {
    render() {
      const {windowOpts, windowPositionBottomRight, windowTitle, externalRemoteWindow, ...props} = this.props
      return <ComposedComponent {...props} remoteWindow={this.props.externalRemoteWindow} />
    }
  }

  return RemoteWindowComponent
}

const mapStateToProps = state => ({
  _badgeInfo: state.notifications.navBadges,
  _edits: state.fs.edits,
  _externalRemoteWindowID: state.config.menubarWindowID,
  _following: state.config.following,
  _pathItems: state.fs.pathItems,
  _tlfUpdates: state.fs.tlfUpdates,
  _uploads: state.fs.uploads,
  conversationsToSend: conversationsToSend(state),
  daemonHandshakeState: state.config.daemonHandshakeState,
  loggedIn: state.config.loggedIn,
  outOfDate: state.config.outOfDate,
  userInfo: state.users.infoMap,
  username: state.config.username,
})

let _lastUsername
let _lastClearCacheTrigger = 0
const mergeProps = stateProps => {
  if (_lastUsername !== stateProps.username) {
    _lastUsername = stateProps.username
    _lastClearCacheTrigger++
  }
  return {
    badgeKeys: stateProps._badgeInfo,
    badgeMap: stateProps._badgeInfo,
    clearCacheTrigger: _lastClearCacheTrigger,
    conversationIDs: stateProps.conversationsToSend,
    conversationMap: stateProps.conversationsToSend,
    daemonHandshakeState: stateProps.daemonHandshakeState,
    externalRemoteWindow: stateProps._externalRemoteWindowID
      ? SafeElectron.getRemote().BrowserWindow.fromId(stateProps._externalRemoteWindowID)
      : null,
    fileRows: {_tlfUpdates: stateProps._tlfUpdates, _uploads: stateProps._uploads},
    following: stateProps._following,
    loggedIn: stateProps.loggedIn,
    outOfDate: stateProps.outOfDate,
    userInfo: stateProps.userInfo,
    username: stateProps.username,
    windowComponent: 'menubar',
    windowOpts,
    windowParam: '',
    windowTitle: '',
    ...uploadsToUploadCountdownHOCProps(stateProps._edits, stateProps._pathItems, stateProps._uploads),
  }
}

const RenderExternalWindowBranch = (ComposedComponent: React.ComponentType<any>) =>
  class extends React.PureComponent<{externalRemoteWindow: ?Object}> {
    render = () => (this.props.externalRemoteWindow ? <ComposedComponent {...this.props} /> : null)
  }

// Actions are handled by remote-container
export default namedConnect<Props | {}, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  mergeProps,
  'MenubarRemoteProxy'
)(RenderExternalWindowBranch(RemoteMenubarWindow(SyncAvatarProps(SyncProps(serialize)(NullComponent)))))
