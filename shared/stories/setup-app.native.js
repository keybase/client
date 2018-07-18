// @flow
import {AppRegistry} from 'react-native'
import {getStorybookUI} from '@storybook/react-native'
import loadStories from './index.native'

const load = () => {
  loadStories()

  const StorybookUI = getStorybookUI({
    host: 'localhost',
    // set this to true to show the in-app UI or just use the web ui
    onDeviceUI: false,
    port: 7007,
  })

  AppRegistry.registerComponent('Keybase', () => StorybookUI)
}

export {load}
