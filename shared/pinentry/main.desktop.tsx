// Entry point for the menubar render window
import * as React from 'react'
import Pinentry from './remote-container.desktop'
import load from '../desktop/remote/component-loader.desktop'
import {deserialize} from './remote-serializer.desktop'

const sessionID = /\?param=(\w+)/.exec(window.location.search)

load({
  child: <Pinentry />,
  deserialize,
  name: 'pinentry',
  // Auto generated from flowToTs. Please clean me!
  params: (sessionID === null || sessionID === undefined ? undefined : sessionID[1]) || '',
})
