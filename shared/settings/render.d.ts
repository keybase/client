import * as React from 'react'
import * as TabConstants from '../constants/tabs'
import {Tab} from '../constants/types/settings'

export type Props = {
  badgeNotifications: boolean
  badgeNumbers: {[K in TabConstants.Tab]: number}
  children: React.ReactNode
  hasRandomPW?: boolean
  loadHasRandomPW: () => void
  contactsLabel: string
  logoutInProgress: boolean
  onLogout: () => void
  onTabChange: (tab: Tab) => void
  selectedTab: Tab
}

declare class Render extends React.Component<Props> {}
export default Render
