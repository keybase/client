// @flow
import * as React from 'react'
import SettingsNav from '.'
import {action, storiesOf} from '../../stories/storybook'

const load = () => {
  storiesOf('Settings/Nav', module).add('Normal', () => (
    <SettingsNav
      badgeNumbers={{}}
      selectedTab={'settingsTabs:landingTab'}
      onTabChange={action('ontabchange')}
      onLogout={action('onlogout')}
    />
  ))
}

export default load
