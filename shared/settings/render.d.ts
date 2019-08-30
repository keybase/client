import * as React from 'react'
import {SettingsTab} from '../constants/settings'
import {Tab} from '../constants/tabs'

export type Props = {
  badgeNotifications: boolean
  badgeNumbers: Map<Tab, number>
  children: React.ReactNode
  hasRandomPW?: boolean
  loadHasRandomPW: () => void
  contactsLabel: string
  logoutInProgress: boolean
  onLogout: () => void
  onTabChange: (tab: SettingsTab) => void
  selectedTab: SettingsTab
}

declare class Render extends React.Component<Props> {}
export default Render
