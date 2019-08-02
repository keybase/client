import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {Avatar, Box} from '..'
import ConfirmModal from '.'
import * as Styles from '../../styles'
import {repeat} from 'lodash-es'

const styles = Styles.styleSheetCreate({
  avatarBox: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    margin: Styles.globalMargins.small,
  },
})

const props = {
  description: 'Description - Explain here what are the consequences of tapping the Confirm button.',
  icon: 'iconfont-keybase' as 'iconfont-keybase',
  onCancel: Sb.action('onCancel'),
  onConfirm: Sb.action('onConfirm'),
  prompt: 'Are you sure…? (can go on 2 lines)',
}

const confirmTextProps = {
  ...props,
  confirmText: 'Yes, delete',
}

const contentProps = {
  ...props,
  content: (
    <Box style={styles.avatarBox}>
      <Avatar
        style={{
          alignSelf: 'center',
          marginRight: Styles.globalMargins.tiny,
        }}
        username={'steve'}
        size={64}
      />
      <Avatar
        style={{alignSelf: 'center', marginLeft: Styles.globalMargins.tiny}}
        isTeam={true}
        teamname={'keybase'}
        size={64}
      />
    </Box>
  ),
}

const headerProps = {
  ...props,
  header: (
    <Box style={styles.avatarBox}>
      <Avatar
        style={{alignSelf: 'center', marginLeft: Styles.globalMargins.tiny}}
        isTeam={true}
        teamname={'keybase'}
        size={64}
      />
    </Box>
  ),
  icon: undefined,
}

const errorText =
  'Oh nOOooOOooOOooooOoooooOOoooooooooooooooo. Something went wrong while other things were going ok and to explain why the service has a very verbose message for you.'

const load = () => {
  Sb.storiesOf('Common/Confirm Modal', module).add('Confirm', () => <ConfirmModal {...props} />)
  Sb.storiesOf('Common/Confirm Modal', module).add('Confirm w/Button Text', () => (
    <ConfirmModal {...confirmTextProps} />
  ))
  Sb.storiesOf('Common/Confirm Modal', module).add('Confirm alternate content', () => (
    <ConfirmModal {...contentProps} />
  ))
  Sb.storiesOf('Common/Confirm Modal', module).add('Confirm alternate header', () => (
    <ConfirmModal {...headerProps} />
  ))
  Sb.storiesOf('Common/Confirm Modal', module).add('Confirm with error', () => (
    <ConfirmModal {...props} error={errorText} />
  ))
  Sb.storiesOf('Common/Confirm Modal', module).add('Confirm with error and header', () => (
    <ConfirmModal {...headerProps} error={errorText} />
  ))
  Sb.storiesOf('Common/Confirm Modal', module).add(
    'Confirm with error and header and long explanation',
    () => <ConfirmModal {...headerProps} error={errorText} description={repeat('long text ', 100)} />
  )
}

export default load
