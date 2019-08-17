import * as React from 'react'
import {SettingsTab} from '../constants/types/settings'

export type Props = {
  badgeNotifications: boolean
  badgeNumbers: Map<SettingsTab, number>
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
