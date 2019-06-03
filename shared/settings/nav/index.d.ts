import {Component} from 'react'
import {Tab} from '../../constants/types/settings'
import * as TabConstants from '../../constants/tabs'
export type Props = {
  logoutInProgress: boolean
  selectedTab: Tab
  onTabChange: (tab: Tab) => void
  onLogout: () => void
  badgeNotifications?: boolean
  badgeNumbers: {[K in TabConstants.Tab]?: number}
  hasRandomPW: boolean | null
}

export default class SettingsNav extends Component<Props> {}
