// @flow
// A mirror of the remote menubar windows.
import * as React from 'react'
import SyncAvatarProps from '../desktop/remote/sync-avatar-props.desktop'
import SyncProps from '../desktop/remote/sync-props.desktop'
import {sendLoad} from '../desktop/remote/sync-browser-window.desktop'
import {NullComponent, connect, type TypedState, compose, renderNothing, branch} from '../util/container'
import * as SafeElectron from '../util/safe-electron.desktop'
import {conversationsToSend} from '../chat/inbox/container/remote'
import {serialize} from './remote-serializer.desktop'
import memoize from 'memoize-one'
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
    _sendLoad = () => {
      sendLoad(
        this.props.externalRemoteWindow.webContents,
        this.props.windowParam,
        this.props.windowComponent,
        this.props.windowTitle
      )
    }

    componentDidMount() {
      this._sendLoad()

      // Allow reloads
      this.props.externalRemoteWindow.webContents.on('did-finish-load', this._sendLoad)

      // uncomment to see menubar devtools
      // this.props.externalRemoteWindow.webContents.openDevTools({mode: 'detach'})
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
  _edits: state.fs.edits,
  _externalRemoteWindowID: state.config.menubarWindowID,
  _following: state.config.following,
  _pathItems: state.fs.pathItems,
  _tlfUpdates: state.fs.tlfUpdates,
  _uploads: state.fs.uploads,
  broken: state.tracker.userTrackers,
  conversationsToSend: conversationsToSend(state),
  loggedIn: state.config.loggedIn,
  username: state.config.username,
})

// TODO we should just send a Set like structure over, for now just extract trackerState
const getBrokenSubset = memoize(userTrackers =>
  Object.keys(userTrackers).reduce((map, name) => {
    map[name] = {
      trackerState: userTrackers[name].trackerState,
    }
    return map
  }, {})
)

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
    broken: getBrokenSubset(stateProps.broken),
    clearCacheTrigger: _lastClearCacheTrigger,
    conversationIDs: stateProps.conversationsToSend,
    conversationMap: stateProps.conversationsToSend,
    externalRemoteWindow: stateProps._externalRemoteWindowID
      ? SafeElectron.getRemote().BrowserWindow.fromId(stateProps._externalRemoteWindowID)
      : null,
    fileRows: {_tlfUpdates: stateProps._tlfUpdates, _uploads: stateProps._uploads},
    following: stateProps._following,
    loggedIn: stateProps.loggedIn,
    username: stateProps.username,
    windowComponent: 'menubar',
    windowOpts,
    windowParam: '',
    windowTitle: '',
    ...uploadsToUploadCountdownHOCProps(stateProps._edits, stateProps._pathItems, stateProps._uploads),
  }
}

// Actions are handled by remote-container
export default compose(
  connect(mapStateToProps, () => ({}), mergeProps),
  // flow correctly complains this shouldn't be true. We really want this to never be null before it hits RemoteMenubarWindow but we can't do that with branch. TODO use a wrapper to fix this
  // $FlowIssue
  branch(props => !props.externalRemoteWindow, renderNothing),
  RemoteMenubarWindow,
  SyncAvatarProps,
  SyncProps(serialize)
)(NullComponent)
