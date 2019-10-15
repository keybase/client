import * as React from 'react'
import * as Sb from '../../stories/storybook'
import AccountSwitcher, {Props} from '.'

const props: Props = {
  accountRows: [
    {
      account: {
        hasStoredSecret: true,
        username: 'jakob224',
      },
      fullName: 'Jakob Test',
    },
    {
      account: {
        hasStoredSecret: false,
        username: 'jakob225',
      },
      fullName: 'Livingston Reallyveryquitelongnameheimer',
    },
  ],
  fullname: 'Alice Keybaseuser',
  onAddAccount: Sb.action('onAddAccount'),
  onCancel: Sb.action('onCancel'),
  onCreateAccount: Sb.action('onCreateAccount'),
  onProfileClick: Sb.action('onProfileClick'),
  onSelectAccount: Sb.action('onSelectAccount'),
  rightActions: [
    {
      color: 'red',
      label: 'Sign out',
      onPress: Sb.action('onSignOut'),
    },
  ],
  title: ' ',
  username: 'alice',
  waiting: false,
}

const load = () => {
  Sb.storiesOf('Account Switcher', module).add('Mobile', () => <AccountSwitcher {...props} />)
}

export default load
