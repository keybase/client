// @flow

import React from 'react'

import {Text} from '../common-adapters'
import TabBar from './index.render'

import type {DumbComponentMap} from '../constants/types/more'
import {profileTab, peopleTab, folderTab, devicesTab, moreTab} from '../constants/tabs'

const badgeNumbers = {
  [profileTab]: 2,
  [peopleTab]: 12,
  [folderTab]: 8,
  [devicesTab]: 0,
  [moreTab]: 0
}

const DummyContent = ({text}) => <Text type='Body'>Filler: {text}</Text>

const tabContent = {
  [profileTab]: <DummyContent text='profile' />,
  [peopleTab]: <DummyContent text='people' />,
  [folderTab]: <DummyContent text='folder' />,
  [devicesTab]: <DummyContent text='devicees' />,
  [moreTab]: <DummyContent text='more' />
}

const map: DumbComponentMap<TabBar> = {
  component: TabBar,
  mocks: {
    'Normal': {
      onTabClick: t => console.log('tabbar:click', t),
      selectedTab: peopleTab,
      username: 'max',
      badgeNumbers,
      tabContent
    },
    'Search Active': {
      onTabClick: t => console.log('tabbar:click', t),
      searchActive: true,
      selectedTab: peopleTab,
      username: 'max',
      badgeNumbers,
      tabContent
    }
  }
}

export default {
  'App TabBar': map
}
