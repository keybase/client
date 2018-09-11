// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  isSelected: boolean,
  name: string,
  keybaseUser: string,
  contents: string,
  onSelect: () => void,
}

const rightColumnStyle = Styles.platformStyles({
  isElectron: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

const rowHeight = Styles.isMobile ? 56 : 48

const backgroundColorSelected = Styles.globalColors.blue

const styles = Styles.styleSheetCreate({
  avatar: {marginRight: Styles.globalMargins.xtiny},

  containerSelected: {
    backgroundColor: backgroundColorSelected,
  },

  containerBox: {
    height: rowHeight,
  },
  containerBoxSelected: {
    height: rowHeight,
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
    backgroundColor: backgroundColorSelected,
  },

  amount: {
    ...rightColumnStyle,
    color: Styles.globalColors.black_40,
    fontSize: 11,
  },
  amountSelected: {
    ...rightColumnStyle,
    color: Styles.globalColors.white,
    backgroundColor: backgroundColorSelected,
    fontSize: 11,
  },
})

const HoverBox = Styles.isMobile
  ? Kb.Box2
  : Styles.glamorous(Kb.Box2)({
      ':hover': {backgroundColor: Styles.globalColors.blueGrey2},
    })

const WalletRow = (props: Props) => {
  return (
    <Kb.ClickableBox onClick={props.onSelect} style={(props.isSelected && styles.containerSelected) || null}>
      <HoverBox
        style={Styles.collapseStyles([
          styles.containerBox,
          props.isSelected ? {backgroundColor: backgroundColorSelected} : {},
        ])}
        direction="horizontal"
        fullWidth={true}
      >
        <Kb.Icon
          type="icon-wallet-64"
          color={Styles.globalColors.black_75}
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
            <Kb.Text type="BodySemibold" style={props.isSelected ? styles.titleSelected : styles.title}>
              {props.name}
            </Kb.Text>
          </Kb.Box2>
          <Kb.Text type="BodySmall" style={props.isSelected ? styles.amountSelected : styles.amount}>
            {props.contents}
          </Kb.Text>
        </Kb.Box2>
      </HoverBox>
    </Kb.ClickableBox>
  )
}

export type {Props}
export {WalletRow}
