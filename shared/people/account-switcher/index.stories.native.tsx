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
    {
      account: {
        hasStoredSecret: true,
        username: 'jakob226',
      },
      fullName: '',
    },
  ],
  fullname: 'Alice Keybaseuser',
  onAddAccount: Sb.action('onAddAccount'),
  onCancel: Sb.action('onCancel'),
  onProfileClick: Sb.action('onProfileClick'),
  onSelectAccount: Sb.action('onSelectAccount'),
  onSignOut: Sb.action('onSignOut'),
  username: 'alice',
  waiting: false,
}

const load = () => {
  Sb.storiesOf('Account Switcher', module).add('Mobile', () => <AccountSwitcher {...props} />)
}

export default load
