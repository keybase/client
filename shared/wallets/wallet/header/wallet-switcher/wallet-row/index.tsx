import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

export type Props = {
  contents: string
  isSelected: boolean
  keybaseUser: string
  name: string
  onSelect: () => void
  unreadPayments: number
}

const styles = Styles.styleSheetCreate({
  amount: {
    color: Styles.globalColors.black_50,
  },
  avatar: {marginRight: Styles.globalMargins.xtiny},
  containerBox: {
    alignItems: 'center',
    backgroundColor: Styles.globalColors.white,
    flexDirection: 'row',
    height: 48,
    justifyContent: 'space-between',
    width: '100%',
  },
  firstRowContainer: {
    alignItems: 'center',
  },
  icon: {
    height: 32,
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
    minWidth: 32,
  },
  rowContainer: {
    alignItems: 'center',
  },
  title: {
    color: Styles.globalColors.blueDark,
  },
  titleSelected: {
    ...Styles.globalStyles.fontSemibold,
    color: Styles.globalColors.black,
  },
})

const WalletRow = (props: Props) => {
  const emptyIcon = <Kb.Box2 direction="horizontal" style={styles.icon} />
  const rightIcon = (
    <Kb.Box2 direction="horizontal" style={styles.icon}>
      {props.isSelected ? (
        <Kb.Icon type="iconfont-check" color={Styles.globalColors.blue} />
      ) : props.unreadPayments > 0 ? (
        <Kb.Badge badgeNumber={props.unreadPayments} />
      ) : null}
    </Kb.Box2>
  )
  return (
    <Kb.ClickableBox onClick={props.onSelect} style={styles.containerBox}>
      {/* Just needed for proper centering */ emptyIcon}
      <Kb.Box2 direction="vertical" style={styles.rowContainer}>
        <Kb.Box2 direction="horizontal" style={styles.firstRowContainer}>
          {!!props.keybaseUser && (
            <Kb.Avatar
              size={16}
              style={Kb.avatarCastPlatformStyles(styles.avatar)}
              username={props.keybaseUser}
            />
          )}
          <Kb.Text type="BodyBig" style={props.isSelected ? styles.titleSelected : styles.title}>
            {props.name}
          </Kb.Text>
        </Kb.Box2>
        <Kb.Text type="BodySmall" style={styles.amount}>
          {props.contents}
        </Kb.Text>
      </Kb.Box2>
      {rightIcon}
    </Kb.ClickableBox>
  )
}

export {WalletRow}
