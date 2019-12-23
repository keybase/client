import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  onClose: () => void
  onRemove: () => void
  member: string
  name: string
}

const ReallyRemoveMember = (props: Props) => (
  <Kb.ConfirmModal
    confirmText={`Yes, remove ${props.member}`}
    description={`${props.member} will lose access to all the ${props.name} chats and folders, and they won't be able to get back unless an admin invites them.`}
    header={
      <Kb.Box style={styles.iconContainer}>
        <Kb.Avatar username={props.member} size={64} />
        <Kb.Box style={styles.icon}>
          <Kb.Icon color={Styles.globalColors.red} type="iconfont-remove" />
        </Kb.Box>
      </Kb.Box>
    }
    onCancel={props.onClose}
    onConfirm={props.onRemove}
    prompt={
      <Kb.Text center={true} type={Styles.isMobile ? 'Header' : 'HeaderBig'} style={styles.header}>
        Are you sure you want to remove {props.member} from&nbsp;{props.name}?
      </Kb.Text>
    }
  />
)

const styles = Styles.styleSheetCreate(() => ({
  header: {padding: Styles.globalMargins.small},
  icon: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      borderRadius: 100,
      bottom: 0,
      position: 'absolute',
      right: 0,
    },
    isMobile: {
      bottom: -2,
      right: -2,
    },
  }),
  iconContainer: {
    position: 'relative',
  },
}))

export default ReallyRemoveMember
