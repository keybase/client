// Entry point for the menubar render window
import * as React from 'react'
import Menubar from './remote-container.desktop'
import load from '../desktop/remote/component-loader.desktop'
import {deserialize} from './remote-serializer.desktop'
import * as Styles from '../styles'

// This is to keep that arrow and gap on top w/ transparency
const style = {
  ...Styles.globalStyles.flexBoxColumn,
  borderTopLeftRadius: 4,
  borderTopRightRadius: 4,
  flex: 1,
  marginTop: 0,
  position: 'relative',
}

load({
  child: <Menubar />,
  deserialize,
  name: 'menubar',
  showOnProps: false,
  style,
})
