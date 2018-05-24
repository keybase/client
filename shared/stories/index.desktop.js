/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
// @flow
import * as React from 'react'
import ScrollView from '../common-adapters/scroll-view'
import {configure, addDecorator} from '@storybook/react'
import commonStories from './stories'
import desktopStories from './platform-stories'

// Load css
import '../desktop/renderer/style.css'

const stories = {...commonStories, ...desktopStories}

const load = () => {
  addDecorator(story => (
    <ScrollView key="scrollview" style={{flex: 1}} contentContainerStyle={{height: '100%'}}>
      {story()}
      <div id="modal-root" />
    </ScrollView>
  ))

  configure(() => {
    Object.keys(stories).forEach(s => stories[s]())
  }, module)
}

export default load
