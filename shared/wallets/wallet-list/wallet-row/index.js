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
    ...globalStyles.fontSemibold,
    ...rightColumnStyle,
    color: globalColors.darkBlue,
    fontSize: 13,
  },
  titleSelected: {
    ...globalStyles.fontSemibold,
    ...rightColumnStyle,
    color: globalColors.white,
    backgroundColor: backgroundColorSelected,
    fontSize: 13,
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

const WalletRow = (props: Props) => {
  return (
    <ClickableBox onClick={props.onSelect} style={(props.isSelected && styles.containerSelected) || null}>
      <Box2
        style={props.isSelected ? styles.containerBoxSelected : styles.containerBox}
        direction="horizontal"
        fullWidth={true}
      >
        <Icon
          type="icon-wallet-64"
          color={globalColors.darkBlue}
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
            <Text type="BodySmall" style={props.isSelected ? styles.titleSelected : styles.title}>
              {props.name}
            </Text>
          </Box2>
          <Text type="BodySmall" style={props.isSelected ? styles.amountSelected : styles.amount}>
            {props.contents}
          </Text>
        </Box2>
      </Box2>
    </ClickableBox>
  )
}

export type {Props}
export {WalletRow}
