// @flow
// Entry point for the menubar render window
import * as React from 'react'
import Tracker from './remote-container.desktop'
import load from '../desktop/remote/component-loader.desktop'
import {deserialize} from './remote-serializer.desktop'

const username = /\?param=(\w+)/.exec(window.location.search)

load({
  child: <Tracker />,
  deserialize,
  name: 'tracker',
  params: username?.[1] || '',
})
