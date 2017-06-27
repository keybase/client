/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
// @flow
import React from 'react'
import ScrollView from '../common-adapters/scroll-view'
import loadAvatar from '../common-adapters/avatar.stories'
import loadBox from '../common-adapters/box.stories'
import {configure, addDecorator} from '@storybook/react-native'

// Load common-adapter stories
const load = () => {
  addDecorator(story => (
    <ScrollView style={{flex: 1}}>
      {story()}
    </ScrollView>
  ))

  configure(() => {
    loadBox()
    loadAvatar()
  }, module)
}

export default load
