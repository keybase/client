// @flow
import Menubar from '../../menubar'
import React, {Component} from 'react'
import RemoteStore from './remote-store.desktop'
import Root from './container'
import hello from '../../util/hello'
import loadPerf from '../../util/load-perf'
import reactDOM from 'react-dom'
import {disable as disableDragDrop} from '../../util/drag-drop'
import {getUserImageMap, loadUserImageMap} from '../../util/pictures'
import {initAvatarLookup, initAvatarLoad} from '../../common-adapters'
import {makeEngine} from '../../engine'
import {remote} from 'electron'
import {setupContextMenu} from '../app/menu-helper'
import {setupSource} from '../../util/forward-logs'

setupSource()
disableDragDrop()
makeEngine()
hello(process.pid, 'Menubar', process.argv, __VERSION__, false) // eslint-disable-line no-undef

if (module.hot) {
  module.hot.accept()
}

let _store

function setupAvatar() {
  initAvatarLookup(getUserImageMap)
  initAvatarLoad(loadUserImageMap)
}

class RemoteMenubar extends Component {
  constructor() {
    super()
    loadPerf()
  }
  render() {
    return (
      <Root store={_store}>
        <Menubar />
      </Root>
    )
  }
}

setupContextMenu(remote.getCurrentWindow())

function load() {
  setupAvatar()
  if (!_store) {
    _store = new RemoteStore({component: 'menubar'})
  }
  reactDOM.render(<RemoteMenubar />, document.getElementById('root'))
}

window.load = load
