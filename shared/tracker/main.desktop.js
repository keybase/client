// @flow
// Entry point for the menubar render window
import * as React from 'react'
import * as Styles from '../styles'
import Tracker from './remote-container.desktop'
import load from '../desktop/remote/component-loader.desktop'
import {deserialize} from './remote-serializer.desktop'

const username = /\?param=(\w+)/.exec(window.location.search)

load({
  child: <Tracker />,
  deserialize,
  name: 'tracker',
  params: username?.[1] || '',
  style: {
    backgroundColor: Styles.globalColors.transparent,
    borderRadius: 8,
    display: 'block',
    height: '100%',
    overflow: 'hidden',
    width: '100%',
  },
})
