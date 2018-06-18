// @flow
import * as React from 'react'
import {Box2, ClickableBox, Icon, Text, Avatar} from '../../../common-adapters'
import {
  globalStyles,
  globalMargins,
  globalColors,
  isMobile,
  platformStyles,
  collapseStyles,
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

const WalletRow = (props: Props) => {
  const backgroundColor = props.isSelected ? globalColors.blue : globalColors.white

  const titleStyle = collapseStyles([
    rightColumnStyle,
    {
      ...globalStyles.fontSemibold,
      color: props.isSelected ? globalColors.white : globalColors.darkBlue,
      backgroundColor,
      fontSize: 13,
    },
  ])

  const amountStyle = collapseStyles([
    rightColumnStyle,
    {
      color: props.isSelected ? globalColors.white : globalColors.black_40,
      backgroundColor,
      fontSize: 11,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  ])

  const rowHeight = isMobile ? 56 : 48

  return (
    <ClickableBox onClick={props.onSelect} style={{backgroundColor}}>
      <Box2 style={{height: rowHeight, backgroundColor}} direction="horizontal" fullWidth={true}>
        <Icon
          type="icon-wallet-64"
          color={globalColors.darkBlue}
          style={{
            alignSelf: 'center',
            height: 32,
            marginLeft: globalMargins.tiny,
            marginRight: globalMargins.tiny,
          }}
        />
        <Box2 direction="vertical" style={rightColumnStyle}>
          <Box2 direction="horizontal" fullWidth={true}>
            {props.keybaseUser && (
              <Avatar size={16} style={{marginRight: globalMargins.xtiny}} username={props.keybaseUser} />
            )}
            <Text type="BodySmall" style={titleStyle}>
              {props.name}
            </Text>
          </Box2>
          <Text type="BodySmall" style={amountStyle}>
            {props.contents}
          </Text>
        </Box2>
      </Box2>
    </ClickableBox>
  )
}

export type {Props}
export {WalletRow}
