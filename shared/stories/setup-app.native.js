// @flow
import {AppRegistry} from 'react-native'
import {getStorybookUI} from '@storybook/react-native'
import loadStories from './index.native.js'

const load = () => {
  loadStories()

  const StorybookUI = getStorybookUI({
    host: 'localhost',
    port: 7007,
  })

  AppRegistry.registerComponent('Keybase', () => StorybookUI)
}

export {load}
