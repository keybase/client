// @flow
import {AppRegistry} from 'react-native'
import {getStorybookUI} from '@storybook/react-native'
import loadStories from './index.native.js'

const load = () => {
  loadStories()

  const StorybookUI = getStorybookUI({
    port: 7007,
    host: 'localhost',
  })

  AppRegistry.registerComponent('Keybase', () => StorybookUI)
}

export default load
