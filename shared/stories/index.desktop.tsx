/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
import * as React from 'react'
import * as Sb from './storybook'
import * as Kb from '../common-adapters'
import {addDecorator} from '@storybook/react'
import sharedStories from './shared-stories'
import desktopStories from './platform-stories.desktop'
// Load css
import '../desktop/renderer/style.css'
import '../chat/conversation/conversation.css'
import {initDesktopStyles} from '../styles/index.desktop'
import {_setSystemIsDarkMode} from '../styles/dark-mode'

const stories = {...sharedStories, ...desktopStories}

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
  const [autoSwap, setAutoSwap] = React.useState(_autoSwap)

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
      <div style={{height: '100%', width: '100%'}}>
        {children}
        <div id="modal-root" />
      </div>
    )
  } else {
    return (
      <>
        <div
          key={darkMode ? 'dark' : 'light'}
          style={{height: '100%', width: '100%'}}
          className={darkMode ? 'darkMode' : 'lightMode'}
        >
          {children}
          <div id="modal-root" key={darkMode ? 'dark' : 'light'} />
        </div>
        <div
          style={{
            border: 'red 1px solid',
            color: darkMode ? 'white' : 'black',
            position: 'absolute',
            right: 0,
            top: 0,
            zIndex: 9999,
          }}
          title="Shift+Click to turn on auto"
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation()
            if (e.shiftKey) {
              setAutoSwap(!autoSwap)
            } else {
              const next = !darkMode
              _setSystemIsDarkMode(next)
              setDarkMode(next)
              setAutoSwap(false)
            }
          }}
        >
          {`${darkMode ? 'Dark Mode' : 'Light Mode'}${autoSwap ? '-auto' : ''}`}
        </div>
      </>
    )
  }
}

const store = Sb.createStoreWithCommon()

const load = () => {
  initDesktopStyles()
  addDecorator((story: any) => <RootWrapper>{story()}</RootWrapper>)
  addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
  Object.keys(filteredStories).forEach(s => filteredStories[s]())
}

export default load
