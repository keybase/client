// @flow
import * as React from 'react'
import SettingsNav from '.'
import {action, storiesOf} from '../../stories/storybook'

const defaultProps = {
  badgeNumbers: {},
  selectedTab: 'settingsTabs:landingTab',
  onTabChange: action('ontabchange'),
  onLogout: action('onlogout'),
}

const load = () => {
  storiesOf('Settings/Nav', module)
    .add('Normal', () => <SettingsNav {...defaultProps} />)
    .add('With a badge (Mobile Only)', () => (
      <SettingsNav {...defaultProps} badgeNumbers={{'tabs:gitTab': 1}} />
    ))
    .add('With a badge on Notifications (Mobile Only)', () => (
      <SettingsNav {...defaultProps} badgeNotifications={true} />
    ))
}

export default load
