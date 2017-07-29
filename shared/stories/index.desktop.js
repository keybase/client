/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
// @flow
import React from 'react'
import ScrollView from '../common-adapters/scroll-view'
import {configure, addDecorator} from '@storybook/react'
import stories from './stories'

// Load css
import '../desktop/renderer/style.css'

const load = () => {
  addDecorator(story => (
    <ScrollView key="scrollview" style={{flex: 1}}>
      {story()}
    </ScrollView>
  ))

  configure(() => {
    Object.keys(stories).forEach(s => stories[s]())
  }, module)
}

export default load
