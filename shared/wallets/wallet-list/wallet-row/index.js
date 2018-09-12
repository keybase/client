// @flow
import * as React from 'react'
import {
  Box2,
  ClickableBox,
  Text,
  Avatar,
  Icon,
  iconCastPlatformStyles,
  avatarCastPlatformStyles,
} from '../../../common-adapters'
import {
  glamorous,
  globalStyles,
  globalMargins,
  globalColors,
  isMobile,
  platformStyles,
  styleSheetCreate,
} from '../../../styles'

type Props = {
  isSelected: boolean,
  name: string,
  keybaseUser: string,
  contents: string,
  onSelect: () => void,
}

const rightColumnStyle = platformStyles({
  isElectron: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

const rowHeight = isMobile ? 56 : 48

const backgroundColorSelected = globalColors.blue

const styles = styleSheetCreate({
  avatar: {marginRight: globalMargins.xtiny},

  containerSelected: {
    backgroundColor: backgroundColorSelected,
  },

  containerBox: {
    height: rowHeight,
  },
  containerBoxSelected: {
    height: rowHeight,
    backgroundColor: backgroundColorSelected,
  },

  icon: {
    alignSelf: 'center',
    height: 32,
    marginLeft: globalMargins.tiny,
    marginRight: globalMargins.tiny,
  },

  rightColumn: rightColumnStyle,

  title: {
    ...rightColumnStyle,
    color: globalColors.black_75,
  },
  titleSelected: {
    ...globalStyles.fontSemibold,
    ...rightColumnStyle,
    color: globalColors.white,
    backgroundColor: backgroundColorSelected,
  },

  amount: {
    ...rightColumnStyle,
    color: globalColors.black_40,
    fontSize: 11,
  },
  amountSelected: {
    ...rightColumnStyle,
    color: globalColors.white,
    backgroundColor: backgroundColorSelected,
    fontSize: 11,
  },
})

const HoverBox = isMobile
  ? Box2
  : glamorous(Box2)({
      ':hover': {backgroundColor: globalColors.blueGrey2},
    })

const WalletRow = (props: Props) => {
  return (
    <ClickableBox onClick={props.onSelect} style={(props.isSelected && styles.containerSelected) || null}>
      <HoverBox
        style={props.isSelected ? styles.containerBoxSelected : styles.containerBox}
        direction="horizontal"
        fullWidth={true}
      >
        <Icon
          type="icon-wallet-64"
          color={globalColors.black_75}
          style={iconCastPlatformStyles(styles.icon)}
        />
        <Box2 direction="vertical" style={styles.rightColumn}>
          <Box2 direction="horizontal" fullWidth={true}>
            {props.keybaseUser && (
              <Avatar
                size={16}
                style={avatarCastPlatformStyles(styles.avatar)}
                username={props.keybaseUser}
              />
            )}
            <Text type="BodySemibold" style={props.isSelected ? styles.titleSelected : styles.title}>
              {props.name}
            </Text>
          </Box2>
          <Text type="BodySmall" style={props.isSelected ? styles.amountSelected : styles.amount}>
            {props.contents}
          </Text>
        </Box2>
      </HoverBox>
    </ClickableBox>
  )
}

export type {Props}
export {WalletRow}
