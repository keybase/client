import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'

import {Props} from './index'

function DeleteConfirm(props: Props) {
  return (
    <Kb.ConfirmModal
      confirmText="Yes, permanently delete it"
      content={
        <Kb.Text type="BodyBig">Are you sure you want to permanently delete your account?</Kb.Text>
      }
      description=""
      header="Header"
      onCancel={props.onCancel}
      onConfirm={props.onDeleteForever}
      prompt={
        <>
          <Kb.Avatar size={48} username={props.username}>
            <Kb.Icon color={Styles.globalColors.red} style={styles.icon} type="iconfont-remove"  />
          </Kb.Avatar>
          <Kb.Text
            type="BodySemibold"
            style={{
              ...Styles.globalStyles.italic,
              color: Styles.globalColors.redDark,
              textDecorationLine: 'line-through',
            }}
          >
            {props.username}
          </Kb.Text>
        </>
      }
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  icon: {
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.white,
    borderRadius: 16,
    borderStyle: 'solid',
    borderWidth: 2,
    bottom: 0,
    padding: '1px 0px 0px 1px',
    position: 'absolute',
    right: -4,
  },
}))

export default DeleteConfirm
