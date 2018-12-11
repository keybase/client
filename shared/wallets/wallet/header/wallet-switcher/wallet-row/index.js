// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

type Props = {|
  contents: string,
  isSelected: boolean,
  keybaseUser: string,
  name: string,
  onSelect: () => void,
  unreadPayments: number,
|}

const styles = Styles.styleSheetCreate({
  amount: {
    color: Styles.globalColors.black_40,
  },
  avatar: {marginRight: Styles.globalMargins.xtiny},
  badge: {
    marginLeft: 6,
  },
  containerBox: {
    height: 48,
  },
  icon: {
    alignSelf: 'center',
    height: 32,
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
  },

  title: {
    color: Styles.globalColors.blue,
  },
  titleSelected: {
    ...Styles.globalStyles.fontSemibold,
    color: Styles.globalColors.black_75,
  },
  unread: {
    backgroundColor: Styles.globalColors.orange,
    borderRadius: 6,
    flexShrink: 0,
    height: Styles.globalMargins.tiny,
    width: Styles.globalMargins.tiny,
  },
  unreadContainer: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'flex-end',
    paddingRight: Styles.globalMargins.tiny,
  },
})

const WalletRow = (props: Props) => {
  return (
    <Kb.ClickableBox onClick={props.onSelect} style={styles.containerBox}>
      <Kb.Box2 direction="vertical">
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          {!!props.keybaseUser && (
            <Kb.Avatar
              size={16}
              style={Kb.avatarCastPlatformStyles(styles.avatar)}
              username={props.keybaseUser}
            />
          )}
          <Kb.Text type="BodySemibold" style={props.isSelected ? styles.titleSelected : styles.title}>
            {props.name}
          </Kb.Text>
        </Kb.Box2>
        <Kb.Text type="BodySmall" style={styles.amount}>
          {props.contents}
        </Kb.Text>
      </Kb.Box2>
      {!!props.unreadPayments && <UnreadIcon unreadPayments={props.unreadPayments} />}
    </Kb.ClickableBox>
  )
}

const UnreadIcon = (props: {unreadPayments: number}) => (
  <Kb.Box2 direction="horizontal" style={styles.unreadContainer}>
    <Kb.Box2 direction="vertical" style={styles.unread} />
  </Kb.Box2>
)
export type {Props}
export {WalletRow}
