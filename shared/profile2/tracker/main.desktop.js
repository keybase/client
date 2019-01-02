// @flow
// Entry point for the menubar render window
import * as React from 'react'
import Profile2 from './remote-container.desktop'
import load from '../../desktop/remote/component-loader.desktop'
import {deserialize} from './remote-serializer.desktop'

const username = /\?param=(\w+)/.exec(window.location.search)

load({
  child: <Profile2 />,
  deserialize,
  name: 'profile2',
  params: username?.[1] || '',
})
