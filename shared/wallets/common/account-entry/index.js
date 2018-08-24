// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type AccountEntryProps = {|
  center?: boolean,
  contents: string,
  keybaseUser: string,
  name: string,
  showWalletIcon: boolean,
  style?: Styles.StylesCrossPlatform,
|}

// A row display of an account, used by the participants components.
// TODO AccountEntry is mostly copied from WalletRow, with some row specific
// properties removed. WalletRow could probably be a wrapper around AccountEntry.
const AccountEntry = (props: AccountEntryProps) => {
  return (
    <Kb.Box2
      style={Styles.collapseStyles([styles.containerBox, props.style])}
      direction="horizontal"
      gap="tiny"
      centerChildren={props.center}
      fullWidth={true}
    >
      {props.showWalletIcon && (
        <Kb.Icon
          type={Styles.isMobile ? 'icon-wallet-32' : 'icon-wallet-64'}
          color={Styles.globalColors.darkBlue}
          style={Kb.iconCastPlatformStyles(styles.icon)}
        />
      )}
      <Kb.Box2 direction="vertical" style={styles.rightColumn}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.user}>
          {props.keybaseUser && (
            <Kb.Avatar
              size={16}
              style={Kb.avatarCastPlatformStyles(styles.avatar)}
              username={props.keybaseUser}
            />
          )}
          <Kb.Text type="BodySmall" style={styles.title}>
            {props.name}
          </Kb.Text>
        </Kb.Box2>
        <Kb.Text
          type="BodySmall"
          style={Styles.collapseStyles([styles.amount, props.center ? {textAlign: 'center'} : {}])}
        >
          {props.contents}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )
}

AccountEntry.defaultProps = {
  showWalletIcon: true,
}

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
    color: Styles.globalColors.black_40,
    fontSize: 11,
  },
  avatar: {marginRight: Styles.globalMargins.xtiny},
  icon: {
    alignSelf: 'center',
    height: 32,
  },
  rightColumn: rightColumnStyle,
  title: {
    ...Styles.globalStyles.fontSemibold,
    ...rightColumnStyle,
    color: Styles.globalColors.darkBlue,
  },
  user: {
    alignItems: 'center',
  },
})

export default AccountEntry
