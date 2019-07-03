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

const rootDecorator = story => (
  <div style={{height: '100%', width: '100%'}}>
    {story()}
    <div id="modal-root" />
  </div>
)

const store = Sb.createStoreWithCommon()

const load = () => {
  initDesktopStyles()
  addDecorator(rootDecorator)
  addDecorator(story => <Sb.MockStore store={store}>{story()}</Sb.MockStore>)
  Object.keys(filteredStories).forEach(s => filteredStories[s]())
}

export default load
