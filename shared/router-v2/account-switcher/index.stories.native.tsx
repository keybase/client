import * as React from 'react'
import * as Sb from '../../stories/storybook'
import AccountSwitcherMobile from '.'

const props = {
  fullname: 'Alice Keybaseuser',
  onAddAccount: Sb.action('onAddAccount'),
  onCancel: Sb.action('onCancel'),
  onCreateAccount: Sb.action('onCreateAccount'),
  onHelp: Sb.action('onHelp'),
  onProfileClick: Sb.action('onProfileClick'),
  onQuit: Sb.action('onQuit'),
  onSelectAccount: Sb.action('onSelectAccount'),
  onSettings: Sb.action('onSettings'),
  onSignOut: Sb.action('onSignOut'),
  rightActions: [
    {
      color: 'red',
      label: 'Sign out',
      onPress: Sb.action('onSignOut'),
    },
  ],
  rows: [
    {
      realName: 'Jakob Test',
      signedIn: true,
      username: 'jakob224',
    },
    {
      realName: 'Livingston Reallyveryquitelongnameheimer',
      signedIn: false,
      username: 'jakob225',
    },
  ],
  username: 'alice',
}

const load = () => {
  Sb.storiesOf('Account Switcher', module).add('Mobile', () => <AccountSwitcherMobile {...props} />)
}

export default load
