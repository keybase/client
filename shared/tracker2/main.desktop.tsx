// Entry point for the tracker render window
import * as React from 'react'
import * as Styles from '../styles'
import Tracker2 from './remote-container.desktop'
import load from '../desktop/remote/component-loader.desktop'
import {deserialize} from './remote-serializer.desktop'

const username = /\?param=(\w+)/.exec(window.location.search)

load({
  child: <Tracker2 />,
  deserialize,
  name: 'tracker2',
  // Auto generated from flowToTs. Please clean me!
  params: (username === null || username === undefined ? undefined : username[1]) || '',
  style: {
    backgroundColor: Styles.globalColors.transparent,
    borderRadius: 8,
    display: 'block',
    height: '100%',
    overflow: 'hidden',
    width: '100%',
  },
})
