/* eslint-disable import/no-extraneous-dependencies, import/no-unresolved, import/extensions */
// @flow
import React from 'react'
import ScrollView from '../common-adapters/scroll-view'
import loadAvatar from '../common-adapters/avatar.stories'
import loadBox from '../common-adapters/box.stories'
import {StatusBar} from 'react-native'
import {action} from '@storybook/addon-actions'
import {configure, addDecorator, storiesOf} from '@storybook/react-native'

// Load common-adapter stories
const load = () => {
  addDecorator(story => [
    <StatusBar key="statusbar" hidden={true} />,
    <ScrollView key="scrollview" style={{flex: 1}}>
      {story()}
    </ScrollView>,
  ])

  configure(() => {
    const payload = {
      action,
      storiesOf,
    }
    loadBox(payload)
    loadAvatar(payload)
  }, module)
}

export default load
