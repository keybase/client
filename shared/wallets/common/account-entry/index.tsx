import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type AccountEntryProps = {
  center?: boolean
  fullWidth?: boolean
  contents: string
  isDefault?: boolean
  keybaseUser: string
  name: string
  showWalletIcon: boolean
  style?: Styles.StylesCrossPlatform
}

// A row display of an account, used by the participants components.
// TODO AccountEntry is mostly copied from WalletRow, with some row specific
// properties removed. WalletRow could probably be a wrapper around AccountEntry.
const AccountEntry = (props: AccountEntryProps) => (
  <Kb.Box2
    style={Styles.collapseStyles([styles.containerBox, props.style])}
    direction="horizontal"
    gap="tiny"
    centerChildren={props.center}
    fullWidth={props.fullWidth}
  >
    {props.showWalletIcon && (
      <Kb.Icon
        type={Styles.isMobile ? 'icon-wallet-32' : 'icon-wallet-64'}
        color={Styles.globalColors.black}
        style={Kb.iconCastPlatformStyles(styles.icon)}
      />
    )}
    <Kb.Box2 direction="vertical" style={styles.rightColumn}>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        style={Styles.collapseStyles([styles.user, props.center && styles.userCenter])}
      >
        {props.keybaseUser && props.isDefault && (
          <Kb.Avatar
            size={16}
            style={Kb.avatarCastPlatformStyles(styles.avatar)}
            username={props.keybaseUser}
          />
        )}
        <Kb.Text type="BodySemibold" style={styles.title}>
          {props.name}
        </Kb.Text>
      </Kb.Box2>
      <Kb.Text
        type="BodySmall"
        selectable={true}
        style={Styles.collapseStyles([styles.amount, props.center && styles.amountCenter])}
      >
        {props.contents}
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

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
    color: Styles.globalColors.black_50,
  },
  amountCenter: {
    textAlign: 'center',
  },
  avatar: {marginRight: Styles.globalMargins.xtiny},
  containerBox: {
    overflow: 'hidden',
  },
  icon: {
    alignSelf: 'center',
    height: 32,
  },
  rightColumn: rightColumnStyle,
  title: {
    ...rightColumnStyle,
    color: Styles.globalColors.black,
  },
  user: {
    alignItems: 'center',
  },
  userCenter: {
    justifyContent: 'center',
  },
})

export default AccountEntry
