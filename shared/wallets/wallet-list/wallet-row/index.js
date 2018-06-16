// @flow
import * as React from 'react'
import {Box2, ClickableBox, Icon, Text, Avatar} from '../../../common-adapters'
import {
  globalStyles,
  globalMargins,
  globalColors,
  isMobile,
  collapseStyles,
  platformStyles,
} from '../../../styles'

type Props = {
  isSelected: boolean,
  name: string,
  keybaseUser: string,
  contents: string,
  onSelect: () => void,
}

const textStyle = platformStyles({
  common: {
    flexBasis: '70%',
  },
  isElectron: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
})

class WalletRow extends React.PureComponent<Props> {
  render() {
    const backgroundColor = this.props.isSelected ? globalColors.blue : globalColors.white

    const titleStyle = collapseStyles([
      textStyle,
      {
        ...globalStyles.fontSemibold,
        color: this.props.isSelected ? globalColors.white : globalColors.darkBlue,
        backgroundColor,
        fontSize: 13,
      },
    ])

    const amountStyle = collapseStyles([
      textStyle,
      {
        color: this.props.isSelected ? globalColors.white : globalColors.black_40,
        backgroundColor,
        fontSize: 11,
      },
    ])

    const props = this.props
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
          <Box2 direction="vertical">
            <Box2 direction="horizontal" fullWidth={true} gap="xtiny">
              {this.props.keybaseUser && <Avatar size={16} username={this.props.keybaseUser} />}
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
}

const rowHeight = isMobile ? 56 : 48

export type {Props}
export {WalletRow}
