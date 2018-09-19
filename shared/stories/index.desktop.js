/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
// @flow
import * as React from 'react'
import * as Sb from './storybook'
import {addDecorator} from '@storybook/react'
import sharedStories from './shared-stories'
import desktopStories from './platform-stories.desktop'

// Load css
import '../desktop/renderer/style.css'

const stories = {...sharedStories, ...desktopStories}

const rootDecorator = story => (
  <div style={{height: '100%', width: '100%'}}>
    {story()}
    <div id="modal-root" />
  </div>
)

const load = () => {
  addDecorator(rootDecorator)
  // $FlowIssue
  addDecorator(Sb.createPropProviderWithCommon())
  Object.keys(stories).forEach(s => stories[s]())
}

export default load
