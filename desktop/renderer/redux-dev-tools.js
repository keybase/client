import React from '../react/base-react'

import {createDevTools} from 'redux-devtools'
import DockMonitor from 'redux-devtools-dock-monitor'
import LogMonitor from 'redux-devtools-log-monitor'
import {reduxDevToolsSelect} from '../react/local-debug.desktop.js'

export default createDevTools(
  <DockMonitor
    toggleVisibilityKey='ctrl-h'
    changePositionKey='ctrl-q'
    defaultIsVisible={false}>
    <LogMonitor theme='tomorrow' select={reduxDevToolsSelect} preserveScrollTop={false}/>
  </DockMonitor>)
