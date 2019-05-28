import * as React from 'react'
import * as TabConstants from '../constants/tabs'
import {Tab} from '../constants/types/settings'

export type Props = {
  children: React.ReactNode
  badgeNumbers: {[K in TabConstants.Tab]: number}
  logoutInProgress: boolean
  selectedTab: Tab
  onTabChange: (tab: Tab) => void
  onLogout: () => void
  badgeNotifications?: boolean
  hasRandomPW?: boolean
}

export default class Render extends React.Component<Props> {}
