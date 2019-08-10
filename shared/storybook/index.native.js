/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Sb from '../stories/storybook'
import {AppRegistry, StatusBar, KeyboardAvoidingView} from 'react-native'
import {getStorybookUI, configure, addDecorator} from '@storybook/react-native'
import sharedStories from '../stories/shared-stories'
import nativeStories from '../stories/platform-stories.native'
import {_setSystemIsDarkMode} from '../styles/dark-mode'

const load = () => {
  loadStories()

  const StorybookUI = getStorybookUI({
    disableWebsockets: false,
    host: 'localhost',
    // set this to true to show the in-app UI or just use the web ui
    // https://github.com/storybooks/storybook/pull/3746#issuecomment-416623500
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

function useInterval(callback, delay) {
  const savedCallback = React.useRef()

  React.useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  React.useEffect(() => {
    function tick() {
      const c = savedCallback.current
      c && c()
    }
    if (delay !== null) {
      let id = setInterval(tick, delay)
      return () => clearInterval(id)
    } else return undefined
  }, [delay])
}
// keep modes in the module so its kept between stories
let _darkMode = false
let _autoSwap = false
const RootWrapper = ({children}) => {
  const [darkMode, setDarkMode] = React.useState(_darkMode)
  const [autoSwap, setAutoSwap] = React.useState(_autoSwap)

  // stash change
  React.useEffect(() => {
    _darkMode = darkMode
    _autoSwap = autoSwap
  }, [darkMode, autoSwap])

  useInterval(
    () => {
      const next = !darkMode
      setDarkMode(next)
      _setSystemIsDarkMode(next)
    },
    autoSwap ? 1000 : null
  )

  return (
    <Kb.Box style={styles.container} key={darkMode ? 'dark' : 'light'}>
      <KeyboardAvoidingView
        behavior={Styles.isIOS ? 'padding' : undefined}
        enabled={true}
        style={styles.keyboard}
      >
        <Kb.Box style={styles.storyWrapper}>
          <StatusBar key="statusbar" hidden={true} />
          {children}
          <Kb.Text
            style={styles.darkButton}
            onLongPress={() => {
              setAutoSwap(!autoSwap)
            }}
            onClick={() => {
              const next = !darkMode
              setDarkMode(next)
              _setSystemIsDarkMode(next)
                setAutoSwap(false)
            }}
          >
            {`${darkMode ? 'Dark Mode' : 'Light Mode'}${autoSwap ? '-auto' : ''}`}
          </Kb.Text>
        </Kb.Box>
      </KeyboardAvoidingView>
    </Kb.Box>
  )
}

const rootDecorator = story => <RootWrapper>{story()}</RootWrapper>

const styles = Styles.styleSheetCreate({
  container: {...Styles.globalStyles.fullHeight},
  darkButton: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  keyboard: {
    ...Styles.globalStyles.fillAbsolute,
    backgroundColor: Styles.globalColors.fastBlank,
  },
  storyWrapper: {...Styles.globalStyles.fullHeight},
})

export default load
