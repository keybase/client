/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
import * as React from 'react'
import * as Sb from './storybook'
import * as Kb from '../common-adapters'
import {addDecorator} from '@storybook/react-native'
import sharedStories from './shared-stories'
import nativeStories from './platform-stories.native'
// Load css
import {_setSystemIsDarkMode} from '../styles/dark-mode'
import {View} from 'react-native'

const stories = {...sharedStories, ...nativeStories}

const filter = process.env.STORYBOOK_FILTER ? new RegExp(process.env.STORYBOOK_FILTER) : null

const filteredStories = Object.keys(stories).reduce(
  (acc, k) => {
    if (filter && filter.exec(k)) {
      acc[k] = stories[k]
    }
    return acc
  },
  filter ? {} : stories
)

// keep modes in the module so its kept between stories
let _darkMode = false
let _autoSwap = false
const RootWrapper = ({children}) => {
  const [darkMode, setDarkMode] = React.useState(_darkMode)
  const [autoSwap] = React.useState(_autoSwap)

  // stash change
  React.useEffect(() => {
    _darkMode = darkMode
    _autoSwap = autoSwap
  }, [darkMode, autoSwap])

  Kb.useInterval(
    () => {
      const next = !darkMode
      _setSystemIsDarkMode(next)
      setDarkMode(next)
    },
    autoSwap ? 1000 : undefined
  )

  if (__STORYSHOT__) {
    return (
      <>
        {children}
        <View key="modal-root" />
      </>
    )
  } else {
    return (
      <>
        <View key={darkMode ? 'dark' : 'light'} style={{height: '100%', width: '100%'}}>
          {children}
          <View key={darkMode ? 'dark' : 'light'} />
        </View>
        <View
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            zIndex: 9999,
          }}
        >
          {`${darkMode ? 'Dark Mode' : 'Light Mode'}${autoSwap ? '-auto' : ''}`}
        </View>
      </>
    )
  }
}

const store = Sb.createStoreWithCommon()

const load = () => {
  addDecorator((story: any) => <RootWrapper>{story()}</RootWrapper>)
  addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
  Object.keys(filteredStories).forEach(s => filteredStories[s]())
}

export default load
