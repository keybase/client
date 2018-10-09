// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {|
  contents: string,
  hasBadge: boolean,
  isSelected: boolean,
  keybaseUser: string,
  name: string,
  onSelect: () => void,
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
  },
  amountSelected: {
    ...rightColumnStyle,
    color: Styles.globalColors.white,
  },
  avatar: {marginRight: Styles.globalMargins.xtiny},
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
    color: Styles.globalColors.black_75,
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
  : Styles.glamorous(Kb.Box2)({
      ':hover': {backgroundColor: Styles.globalColors.blueGrey2},
    })

const WalletRow = (props: Props) => {
  return (
    <Kb.ClickableBox onClick={props.onSelect}>
      <HoverBox
        style={Styles.collapseStyles([
          styles.containerBox,
          props.isSelected ? {backgroundColor: Styles.globalColors.purple3} : {},
        ])}
        direction="horizontal"
        fullWidth={true}
      >
        <Kb.Icon
          type={props.isSelected ? 'icon-wallet-open-32' : 'icon-wallet-32'}
          color={Styles.globalColors.black_75}
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
        {props.hasBadge && <UnreadIcon />}
      </HoverBox>
      <Kb.Divider />
    </Kb.ClickableBox>
  )
}

const UnreadIcon = () => (
  <Kb.Box2 direction="horizontal" style={styles.unreadContainer}>
    <Kb.Box2 direction="vertical" style={styles.unread} />
  </Kb.Box2>
)

export type {Props}
export {WalletRow}
