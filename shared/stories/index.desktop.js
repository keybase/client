/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
// @flow
import * as React from 'react'
import ScrollView from '../common-adapters/scroll-view'
import {configure, addDecorator} from '@storybook/react'
import commonStories from './stories'
import desktopStories from './stories-desktop'

const stories = {...commonStories, ...desktopStories}

const scrollViewDecorator = story => (
  <ScrollView key="scrollview" style={{flex: 1}} contentContainerStyle={{height: '100%'}}>
    {story()}
  </ScrollView>
)

// Stories w/ their own scrolling views
const noScrollBars = ['threadView']

// Load common-adapter stories
const load = () => {
  configure(() => {
    noScrollBars.forEach(s => stories[s]())

    addDecorator(scrollViewDecorator)
    Object.keys(stories)
      .filter(s => !noScrollBars.includes(s))
      .forEach(s => stories[s]())
  }, module)
}

export default load
