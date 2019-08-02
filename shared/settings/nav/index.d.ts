import {Component} from 'react'
import {Tab} from '../../constants/types/settings'
import * as TabConstants from '../../constants/tabs'
export type Props = {
  badgeNotifications?: boolean
  badgeNumbers: {[K in TabConstants.Tab]?: number}
  contactsLabel: string
  hasRandomPW: boolean | null
  logoutInProgress: boolean
  onLogout: () => void
  onTabChange: (tab: Tab) => void
  selectedTab: Tab
}

export default class SettingsNav extends Component<Props> {}
