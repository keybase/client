// @flow
import DockMonitor from 'redux-devtools-dock-monitor'
import LogMonitor from 'redux-devtools-log-monitor'
import React from 'react'
import {createDevTools} from 'redux-devtools'
import {reduxDevToolsSelect} from '../../local-debug.desktop.js'

export default createDevTools(
  <DockMonitor
    toggleVisibilityKey="ctrl-h"
    changePositionKey="ctrl-q"
    defaultIsVisible={false}
  >
    <LogMonitor
      theme="tomorrow"
      select={reduxDevToolsSelect}
      preserveScrollTop={false}
      expandActionRoot={false}
      expandStateRoot={false}
    />
  </DockMonitor>
)
