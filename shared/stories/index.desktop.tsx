/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
import * as React from 'react'
import * as Sb from './storybook'
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

function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = React.useRef<() => void>()

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

  if (__STORYSHOT__) {
    return (
      <div style={{height: '100%', width: '100%'}}>
        {children}
        <div id="modal-root" />
      </div>
    )
  } else {
    return (
      <div
        key={darkMode ? 'dark' : 'light'}
        style={{height: '100%', width: '100%'}}
        className={darkMode ? 'darkMode' : ''}
      >
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
            if (e.shiftKey) {
              setAutoSwap(!autoSwap)
            } else {
              const next = !darkMode
              setDarkMode(next)
              _setSystemIsDarkMode(next)
              setAutoSwap(false)
            }
          }}
        >
          {`${darkMode ? 'Dark Mode' : 'Light Mode'}${autoSwap ? '-auto' : ''}`}
        </div>
        {children}
        <div id="modal-root" />
      </div>
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
