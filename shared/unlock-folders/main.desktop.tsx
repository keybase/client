// Entry point for the menubar render window
import * as React from 'react'
import UnlockFolders from './remote-container.desktop'
import load from '../desktop/remote/component-loader.desktop'
import {deserialize} from './remote-serializer.desktop'

load({
  child: <UnlockFolders />,
  deserialize,
  name: 'unlock-folders',
})
