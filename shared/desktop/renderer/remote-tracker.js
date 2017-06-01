// @flow
import React, {Component} from 'react'
// import RemoteComponent from './remote-component'
import electron from 'electron'
import menuHelper from '../app/menu-helper'
import hotPath from '../hot-path'
import {connect} from 'react-redux'
import {injectReactQueryParams} from '../../util/dev'
import {onClose, startTimer, stopTimer, getProfile} from '../../actions/tracker'
import {resolveRootAsURL} from '../resolve-root'
import {showDevTools, skipSecondaryDevtools} from '../../local-debug.desktop'

import type {TypedState} from '../../constants/reducer'
import type {TrackerOrNonUserState} from '../../constants/tracker'

const BrowserWindow = electron.BrowserWindow || electron.remote.BrowserWindow
const ipcRenderer = electron.ipcRenderer
// import type {Action} from '../../constants/types/flux'

class _RemoteTracker extends Component<void, TrackerOrNonUserState & {username: string}, void> {
  _window = null
  _remoteWindowId = 0

  _makeWindow = () => {
    if (this._window) {
      return
    }
    const browser = new BrowserWindow({
      frame: false,
      fullscreen: false,
      height: 470,
      resizable: false,
      show: false,
      width: 320,
    })

    this._window = browser

    this._remoteWindowId = browser.id

    if (electron.screen.getPrimaryDisplay()) {
      const {width, height} = electron.screen.getPrimaryDisplay().workAreaSize
      browser.setPosition(width - 320 - 100, height - 470 - 100, false)
    }

    menuHelper(browser)
    // this.closed = false

    ipcRenderer.send('showDockIconForRemoteWindow', this._remoteWindowId)
    ipcRenderer.send('listenForRemoteWindowClosed', this._remoteWindowId)

    browser.loadURL(resolveRootAsURL('renderer', injectReactQueryParams('renderer.html?tracker')))

    const webContents = browser.webContents
    webContents.on('did-finish-load', () => {
      debugger
      webContents.send('load', {
        component: 'tracker',
        scripts: [
          ...(__DEV__
            ? [
                {
                  async: false,
                  src: resolveRootAsURL('dist', 'dll/dll.vendor.js'),
                },
              ]
            : []),
          {
            async: false,
            src: hotPath('remote-component-loader.bundle.js'),
          },
        ],
        selectorParams: this.props.username,
        title: `tracker - ${this.props.username}`,
      })
    })

    if (showDevTools && !skipSecondaryDevtools) {
      webContents.openDevTools('detach')
    }
  }

  render() {
    this._makeWindow()

    if (!this._window) return null

    const w: BrowserWindow = this._window

    w.emit('hasProps', this.props)

    if (this.props.hidden) {
      w.hide()
    } else {
      w.show()
    }

    return null
  }
}

const mapStateToRemoteTrackerProps = (state: TypedState, {username}) => ({
  username,
  ...state.tracker.trackers[username],
})
const mapDispatchToRemoteTrackerProps = () => ({})

const RemoteTracker = connect(mapStateToRemoteTrackerProps, mapDispatchToRemoteTrackerProps)(_RemoteTracker)

const _RemoteTrackers = ({usernames}) => {
  return (
    <div>
      {usernames.map(username => <RemoteTracker key={username} username={username} />)}
    </div>
  )
}

// type Props = {
// onClose: (username: string) => void,
// started: boolean,
// errorRetry: (username: string) => void,
// startTimer: () => void,
// stopTimer: () => Action,
// trackers: {[key: string]: TrackerOrNonUserState},
// }

// class RemoteTracker extends Component<void, Props, void> {
// // shouldComponentUpdate(nextProps, nextState) {
// // return nextProps.trackers !== this.props.trackers
// // }

// render() {
// const {trackers} = this.props
// // const windowsOpts = {height: 470, width: 320}

// // return (
// // <div>
// // {Object.keys(trackers)
// // .filter(username => !trackers[username].closed)
// // .map(username => (
// // <RemoteComponent
// // positionBottomRight={true}
// // windowsOpts={windowsOpts}
// // title={`tracker - ${username}`}
// // waitForState={true}
// // ignoreNewProps={true}
// // hidden={trackers[username].hidden}
// // onRemoteClose={() => this.props.onClose(username)}
// // component="tracker"
// // username={username}
// // startTimer={this.props.startTimer}
// // errorRetry={() => this.props.errorRetry(username)}
// // stopTimer={this.props.stopTimer}
// // selectorParams={username}
// // key={username}
// // />
// // ))}
// // </div>
// // )
// }
// }

// type OwnProps = {}

const mapStateToRemoteTrackersProps = (state: TypedState) => ({
  started: state.tracker.serverStarted,
  usernames: Object.keys(state.tracker.trackers),
})

const mapDispatchToRemoteTrackersProps = (dispatch: any) => ({
  errorRetry: (username: string) => {
    dispatch(getProfile(username, true))
  },
  onClose: (username: string) => {
    dispatch(onClose(username))
  },
  startTimer: () => dispatch(startTimer()),
  stopTimer: () => dispatch(stopTimer()),
})

export default connect(mapStateToRemoteTrackersProps, mapDispatchToRemoteTrackersProps)(_RemoteTrackers)
