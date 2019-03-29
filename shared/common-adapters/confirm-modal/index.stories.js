// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {Avatar, Box} from '..'
import ConfirmModal from '.'
import * as Styles from '../../styles'

const styles = Styles.styleSheetCreate({
  avatarBox: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    margin: Styles.globalMargins.small,
  },
})

const props = {
  description: 'Description - Explain here what are the consequences of tapping the Confirm button.',
  icon: 'iconfont-keybase',
  onCancel: Sb.action('onCancel'),
  onConfirm: Sb.action('onConfirm'),
  prompt: 'Are you sure…? (can go on 2 lines)',
}
// eslint-disable-next-line no-unused-vars
const confirmTextProps = {
  ...props,
  confirmText: 'Yes, delete',
}
// eslint-disable-next-line no-unused-vars
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

// eslint-disable-next-line no-unused-vars
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

const load = () => {
  Sb.storiesOf('Common/Confirm Modal', module).add('Confirm', () => <ConfirmModal {...props} />)
}

export default load
