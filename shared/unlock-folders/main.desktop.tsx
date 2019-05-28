// Entry point for the menubar render window
import * as React from 'react'
import UnlockFolders from './remote-container.desktop'
import load from '../desktop/remote/component-loader.desktop'
import {deserialize} from './remote-serializer.desktop'

load({
  // @ts-ignore codemod issue
  child: <UnlockFolders />,
  deserialize,
  name: 'unlock-folders',
})
