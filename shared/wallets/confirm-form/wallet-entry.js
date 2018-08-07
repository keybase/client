// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type WalletEntryProps = {
  name: string,
  keybaseUser: string,
  contents: string,
  style?: Styles.StylesCrossPlatform,
}

// TODO WalletEntry is mostly copied from WalletRow, with some row specific
// properties removed. WalletRow could probably be a wrapper around WalletEntry.
const WalletEntry = (props: WalletEntryProps) => {
  return (
    <Kb.Box2
      style={Styles.collapseStyles([styles.containerBox, props.style])}
      direction="horizontal"
      fullWidth={true}
    >
      <Kb.Icon
        type="icon-wallet-64"
        color={Styles.globalColors.darkBlue}
        style={Kb.iconCastPlatformStyles(styles.icon)}
      />
      <Kb.Box2 direction="vertical" style={styles.rightColumn}>
        <Kb.Box2 direction="horizontal" fullWidth={true}>
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
        <Kb.Text type="BodySmall" style={styles.amount}>
          {props.contents}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const rightColumnStyle = Styles.platformStyles({
  isElectron: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

const styles = Styles.styleSheetCreate({
  avatar: {marginRight: Styles.globalMargins.xtiny},

  icon: {
    alignSelf: 'center',
    height: 32,
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
  },

  rightColumn: rightColumnStyle,

  title: {
    ...Styles.globalStyles.fontSemibold,
    ...rightColumnStyle,
    color: Styles.globalColors.darkBlue,
  },

  amount: {
    ...rightColumnStyle,
    color: Styles.globalColors.black_40,
    fontSize: 11,
  },
})

export default WalletEntry
