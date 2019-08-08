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

const RootWrapper = ({children}) => {
  const [darkMode, setDarkMode] = React.useState(false)

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
        onClick={() => {
          setDarkMode(!darkMode)
          _setSystemIsDarkMode(!darkMode)
        }}
      >
        {darkMode ? 'Dark Mode' : 'Light Mode'}
      </div>
      {children}
      <div id="modal-root" />
    </div>
  )
}

const store = Sb.createStoreWithCommon()

const load = () => {
  initDesktopStyles()
  addDecorator((story: any) => <RootWrapper>{story()}</RootWrapper>)
  addDecorator((story: any) => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
  Object.keys(filteredStories).forEach(s => filteredStories[s]())
}

export default load
