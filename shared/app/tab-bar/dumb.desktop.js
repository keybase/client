// @flow

import React from 'react'

import {Text} from '../../common-adapters'
import TabBar from './index.render'

import type {DumbComponentMap} from '../../constants/types/more'
import {
  profileTab,
  peopleTab,
  folderTab,
  chatTab,
  devicesTab,
  searchTab,
  settingsTab,
} from '../../constants/tabs'

const badgeNumbers = {
  [profileTab]: 9,
  [peopleTab]: 9,
  [folderTab]: 9,
  [chatTab]: 9,
  [devicesTab]: 9,
  [settingsTab]: 9,
}

const tabContent = (() => {
  // wrapped in a self-calling function to prevent React Hot Loader
  const DummyContent = ({text}) =>
    <Text type="Body">
      Filler: {text}
    </Text>

  return {
    [profileTab]: <DummyContent text="profile" />,
    [peopleTab]: <DummyContent text="people" />,
    [folderTab]: <DummyContent text="folder" />,
    [chatTab]: <DummyContent text="chat" />,
    [devicesTab]: <DummyContent text="devicees" />,
    [settingsTab]: <DummyContent text="settings" />,
  }
})()

const map: DumbComponentMap<TabBar> = {
  component: TabBar,
  mocks: {
    Normal: {
      onTabClick: t => console.log('tabbar:click', t),
      selectedTab: peopleTab,
      username: 'max',
      badgeNumbers,
      tabContent,
    },
    'Search Active': {
      onTabClick: t => console.log('tabbar:click', t),
      selectedTab: searchTab,
      username: 'max',
      badgeNumbers,
      tabContent,
    },
  },
}

export default {
  'App TabBar': map,
}
