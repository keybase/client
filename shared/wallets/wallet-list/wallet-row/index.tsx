import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

// TODO: This is now desktop-only, so remove references to isMobile.

export type Props = {
  airdropSelected: boolean
  contents: string
  isSelected: boolean
  keybaseUser: string
  name: string
  onSelect: () => void
  unreadPayments: number
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
  },
  amountSelected: {
    ...rightColumnStyle,
    color: Styles.globalColors.white,
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
    color: Styles.globalColors.black,
  },
  titleSelected: {
    ...Styles.globalStyles.fontSemibold,
    ...rightColumnStyle,
    color: Styles.globalColors.white,
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

const HoverBox = Styles.isMobile
  ? Kb.Box2
  : Styles.styled(Kb.Box2)({
      ':hover': {backgroundColor: Styles.globalColors.blueGreyDark},
    })

const WalletRow = (props: Props) => {
  return (
    <Kb.ClickableBox onClick={props.onSelect}>
      <HoverBox
        style={Styles.collapseStyles([
          styles.containerBox,
          props.isSelected ? {backgroundColor: Styles.globalColors.purpleLight} : {},
        ])}
        direction="horizontal"
        fullWidth={true}
      >
        <Kb.Icon
          type={props.isSelected ? 'icon-wallet-open-32' : 'icon-wallet-32'}
          color={Styles.globalColors.black}
          style={Kb.iconCastPlatformStyles(styles.icon)}
        />
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
      </HoverBox>
      <Kb.Divider />
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

export {WalletRow}
