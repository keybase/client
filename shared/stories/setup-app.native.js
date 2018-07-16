// @flow
import mock from './mock-react-redux'
import {AppRegistry} from 'react-native'
import {getStorybookUI} from '@storybook/react-native'
import loadStories from './index.native'

const load = () => {
  mock()
  loadStories()

  const StorybookUI = getStorybookUI({
    host: 'localhost',
    // set this to false to hide the in-app UI and just use the web ui
    onDeviceUI: false,
    port: 7007,
  })

  AppRegistry.registerComponent('Keybase', () => StorybookUI)
}

export {load}
