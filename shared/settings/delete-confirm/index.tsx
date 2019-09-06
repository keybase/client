import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'

export type Props = {
  username: string
  allowDeleteForever: boolean
  setAllowDeleteAccount: (allow: boolean) => void
  onCancel: () => void
  onDeleteForever: () => void
}

function DeleteConfirm(props: Props) {
  return (
    <Kb.ConfirmModal
      confirmText="Yes, permanently delete it"
      content={
        <Kb.Text center={true} type="BodyBig">cont: Are you sure you want to permanently delete your account?</Kb.Text>
      }
      description="desc: Are you sure you want to permanently delete your account?"
      onCancel={props.onCancel}
      onConfirm={props.onDeleteForever}
      onConfirmDeactivated={!props.allowDeleteForever}
      prompt={
        <>
          <Kb.Avatar size={Styles.isMobile ? 64 : 48} username={props.username} style={styles.avatar}>
            <Kb.Box2 direction="horizontal" style={styles.iconContainer}>
              <Kb.Icon color={Styles.globalColors.red} type="iconfont-remove"  />
            </Kb.Box2>
          </Kb.Avatar>
          <Kb.Text type="BodySemibold" style={styles.strike}>
            {props.username}
          </Kb.Text>
        </>
      }
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  avatar: Styles.platformStyles({
    isMobile: {
      marginBottom: Styles.globalMargins.small,
      marginTop: Styles.globalMargins.small,
    },
  }),
  iconContainer: {
    ...Styles.padding(1, 0, 0, 1),
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.white,
    borderRadius: 100,
    borderStyle: 'solid',
    borderWidth: 2,
    bottom: 0,
    position: 'absolute',
    right: -4,
  },
  strike: {
    ...Styles.globalStyles.italic,
    color: Styles.globalColors.redDark,
    textDecorationLine: 'line-through',
  },
}))

export default DeleteConfirm
