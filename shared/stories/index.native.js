/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Sb from './storybook'
import {AppRegistry, StatusBar, KeyboardAvoidingView} from 'react-native'
import {getStorybookUI, configure, addDecorator} from '@storybook/react-native'
import sharedStories from './shared-stories'
import nativeStories from './platform-stories.native'

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

const stories = {...sharedStories, ...nativeStories}

// Load common-adapter stories
const loadStories = () => {
  configure(() => {
    addDecorator(rootDecorator)
    addDecorator(Sb.createPropProviderWithCommon())
    Object.keys(stories).forEach(s => stories[s]())
  }, module)
}

const rootDecorator = story => (
  <Kb.Box style={styles.container}>
    <KeyboardAvoidingView
      behavior={Styles.isIOS ? 'padding' : undefined}
      enabled={true}
      style={styles.keyboard}
    >
      <Kb.Box style={styles.storyWrapper}>
        <StatusBar key="statusbar" hidden={true} />
        {story()}
      </Kb.Box>
    </KeyboardAvoidingView>
  </Kb.Box>
)

const styles = Styles.styleSheetCreate({
  container: {...Styles.globalStyles.fullHeight},
  keyboard: {
    ...Styles.globalStyles.fillAbsolute,
    backgroundColor: Styles.globalColors.fastBlank,
  },
  storyWrapper: {...Styles.globalStyles.fullHeight},
})

export default load
