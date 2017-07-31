/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
// @flow
import React from 'react'
import ScrollView from '../common-adapters/scroll-view'
import loadAvatar from '../common-adapters/avatar.stories'
import loadBox from '../common-adapters/box.stories'
import loadIcon from '../common-adapters/icon.stories'
import loadCheckbox from '../common-adapters/checkbox.stories'
import loadText from '../common-adapters/text.stories'
import loadChatList from '../chat/conversation/list/index.stories'
import {StatusBar} from 'react-native'
import {configure, addDecorator} from '@storybook/react-native'

const scrollViewDecorator = story => [
  <StatusBar key="statusbar" hidden={true} />,
  <ScrollView key="scrollview" style={{flex: 1}}>
    {story()}
  </ScrollView>,
]

// Load common-adapter stories
const load = () => {
  configure(() => {
    loadChatList()
    // If you want a scroll view, but the load fn after this decorator. Otherewise before
    addDecorator(scrollViewDecorator)
    loadAvatar()
    loadBox()
    loadCheckbox()
    loadIcon()
    loadText()
  }, module)
}

export default load
