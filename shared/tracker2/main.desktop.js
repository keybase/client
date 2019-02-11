// @flow
// Entry point for the tracker render window
import * as React from 'react'
import Tracker2 from './remote-container.desktop'
import load from '../desktop/remote/component-loader.desktop'
import {deserialize} from './remote-serializer.desktop'

const username = /\?param=(\w+)/.exec(window.location.search)

load({
  child: <Tracker2 />,
  deserialize,
  name: 'tracker2',
  params: username?.[1] || '',
})
