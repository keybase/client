import * as React from 'react'
import * as Sb from '../../stories/storybook'
import AccountSwitcherMobile, {Props} from '.'
import * as ConfigConstants from '../../constants/config'

const props: Props = {
  accountRows: [
    {
      account: ConfigConstants.makeConfiguredAccount({
        hasStoredSecret: true,
        username: 'jakob224',
      }),
      fullName: 'Jakob Test',
    },
    {
      account: ConfigConstants.makeConfiguredAccount({
        hasStoredSecret: false,
        username: 'jakob225',
      }),
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
      // TODO: color: 'red',
      label: 'Sign out',
      onPress: Sb.action('onSignOut'),
    },
  ],
  username: 'alice',
}

const load = () => {
  Sb.storiesOf('Account Switcher', module).add('Mobile', () => <AccountSwitcherMobile {...props} />)
}

export default load
