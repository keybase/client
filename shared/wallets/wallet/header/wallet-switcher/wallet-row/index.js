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

const rightColumnStyle = Styles.platformStyles({
  isElectron: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

const styles = Styles.styleSheetCreate({
  amount: {
    ...rightColumnStyle,
    color: Styles.globalColors.blue,
  },
  amountSelected: {
    ...rightColumnStyle,
    color: Styles.globalColors.black_75,
  },
  avatar: {marginRight: Styles.globalMargins.xtiny},
  badge: {
    marginLeft: 6,
  },
  containerBox: {
    height: Styles.isMobile ? 56 : 48,
  },
  icon: {
    alignSelf: 'center',
    height: 32,
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
  },

  rightColumn: rightColumnStyle,

  title: {
    ...rightColumnStyle,
    color: Styles.globalColors.blue,
  },
  titleSelected: {
    ...Styles.globalStyles.fontSemibold,
    ...rightColumnStyle,
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
      <Kb.Box2 direction="vertical" style={styles.rightColumn}>
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
        <Kb.Text type="BodySmall" style={props.isSelected ? styles.amountSelected : styles.amount}>
          {props.contents}
        </Kb.Text>
      </Kb.Box2>
      {!!props.unreadPayments && <UnreadIcon unreadPayments={props.unreadPayments} />}
    </Kb.ClickableBox>
  )
}

const UnreadIcon = (props: {unreadPayments: number}) => (
  <Kb.Box2 direction="horizontal" style={styles.unreadContainer}>
    {Styles.isMobile ? (
      <Kb.Badge badgeNumber={props.unreadPayments} badgeStyle={styles.badge} />
    ) : (
      <Kb.Box2 direction="vertical" style={styles.unread} />
    )}
  </Kb.Box2>
)
export type {Props}
export {WalletRow}
