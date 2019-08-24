import * as React from 'react'
import SettingsNav from '.'
import {action, storiesOf} from '../../stories/storybook'

const defaultProps = {
  badgeNumbers: {},
  contactsLabel: 'Import contacts',
  hasRandomPW: null,
  logoutInProgress: false,
  onLogout: action('onlogout'),
  onTabChange: action('ontabchange'),
  selectedTab: 'settingsTabs.accountTab' as 'settingsTabs.accountTab',
}

const load = () => {
  storiesOf('Settings/Nav', module)
    .add('Normal', () => <SettingsNav {...defaultProps} />)
    .add('With a badge (Mobile Only)', () => (
      <SettingsNav {...defaultProps} badgeNumbers={{'tabs.gitTab': 1}} />
    ))
    .add('With a badge on Notifications (Mobile Only)', () => (
      <SettingsNav {...defaultProps} badgeNotifications={true} />
    ))
    .add('Logging out', () => <SettingsNav {...defaultProps} logoutInProgress={true} />)
}

export default load
