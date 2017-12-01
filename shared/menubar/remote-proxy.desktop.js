// @flow
// A mirror of the remote menubar windows.
import * as React from 'react'
import SyncAvatarProps from '../desktop/remote/sync-avatar-props.desktop'
import SyncProps from '../desktop/remote/sync-props.desktop'
import {sendLoad} from '../desktop/remote/sync-browser-window.desktop'
import {connect, type TypedState, compose, renderNothing, branch} from '../util/container'
import {remote} from 'electron'

const windowOpts = {}

type Props = {
  externalRemoteWindow: any,
  windowOpts?: Object,
  positionBottomRight?: boolean,
  component: string,
  title: string,
  selectorParams: string,
}

// Like RemoteWindow but the browserWindow is handled by the 3rd party menubar class and mostly lets it handle things
function RemoteMenubarWindow(ComposedComponent: any) {
  class RemoteWindowComponent extends React.PureComponent<Props> {
    componentWillMount() {
      sendLoad(
        this.props.externalRemoteWindow.webContents,
        this.props.selectorParams,
        this.props.component,
        this.props.title
      )

      // uncomment to see menubar devtools
      // this.props.externalRemoteWindow.webContents.openDevTools('detach')
    }
    render() {
      const {windowOpts, positionBottomRight, title, externalRemoteWindow, ...props} = this.props
      return <ComposedComponent {...props} remoteWindow={this.props.externalRemoteWindow} />
    }
  }

  return RemoteWindowComponent
}

const mapStateToProps = (state: TypedState, {id}) => ({
  _badgeInfo: state.notifications.navBadges,
  _externalRemoteWindowID: state.config.menubarWindowID,
  extendedConfig: state.config.extendedConfig,
  folderProps: state.favorite.folderState,
  kbfsStatus: state.favorite.kbfsStatus,
  loggedIn: state.config.loggedIn,
  username: state.config.username,
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  badgeInfo: stateProps._badgeInfo.toJS(),
  component: 'menubar',
  extendedConfig: stateProps.extendedConfig,
  externalRemoteWindow: stateProps._externalRemoteWindowID
    ? remote.BrowserWindow.fromId(stateProps._externalRemoteWindowID)
    : null,
  folderProps: stateProps.folderProps,
  kbfsStatus: stateProps.kbfsStatus,
  loggedIn: stateProps.loggedIn,
  selectorParams: '',
  title: '',
  username: stateProps.username,
  windowOpts,
})

// Actions are handled by remote-container
export default compose(
  connect(mapStateToProps, () => ({}), mergeProps),
  branch(props => !props.externalRemoteWindow, renderNothing),
  RemoteMenubarWindow,
  SyncAvatarProps,
  SyncProps,
  renderNothing
)(null)
