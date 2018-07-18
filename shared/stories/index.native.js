/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
// @flow
import * as React from 'react'
import ScrollView from '../common-adapters/scroll-view'
import {StatusBar} from 'react-native'
import {configure, addDecorator} from '@storybook/react-native'
import commonStories from './stories'
import nativeStories from './platform-stories'

const stories = {...commonStories, ...nativeStories}

const scrollViewDecorator = story => [
  <StatusBar key="statusbar" hidden={true} />,
  <ScrollView
    key="scrollview"
    style={{height: '100%', width: '100%'}}
    contentContainerStyle={{minHeight: '100%', minWidth: '100%'}}
  >
    {story()}
  </ScrollView>,
]

// Stories w/ their own scrolling views
// const noScrollBars = [[> 'chatList', <] 'chatManageChannels']
// TODO figure out a better way to do this
const noScrollBars = []

// Load common-adapter stories
const load = () => {
  configure(() => {
    noScrollBars.forEach(s => stories[s] && stories[s]())

    addDecorator(scrollViewDecorator)
    Object.keys(stories)
      .filter(s => !noScrollBars.includes(s))
      .forEach(s => stories[s]())
  }, module)
}

export default load
