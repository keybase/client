// @flow
import Menubar from '../../menubar'
import React, {Component} from 'react'
import RemoteStore from './remote-store.desktop'
import Root from './container'
import hello from '../../util/hello'
import loadPerf from '../../util/load-perf'
import reactDOM from 'react-dom'
import {disable as disableDragDrop} from '../../util/drag-drop'
import {makeEngine} from '../../engine'
import {remote} from 'electron'
import {setupContextMenu} from '../app/menu-helper'
// $FlowIssue
import {setupSource} from '../../util/forward-logs'

setupSource()
disableDragDrop()
makeEngine()
hello(process.pid, 'Menubar', process.argv, __VERSION__) // eslint-disable-line no-undef

if (module.hot) {
  module.hot.accept()
}

const store = new RemoteStore({component: 'menubar'})

class RemoteMenubar extends Component {
  constructor () {
    super()
    loadPerf()
  }
  render () {
    return (
      <Root store={store}>
        <Menubar />
      </Root>
    )
  }
}

setupContextMenu(remote.getCurrentWindow())

function load () {
  reactDOM.render(<RemoteMenubar />, document.getElementById('root'))
}

window.load = load
