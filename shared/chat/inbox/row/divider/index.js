// @flow
import * as React from 'react'
import {ClickableBox, Box, Text, Badge} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins, isMobile} from '../../../../styles'

type Props = {
  badgeCount: number,
  hiddenCount: number,
  style?: string,
  toggle: () => void,
}

class Divider extends React.PureComponent<Props> {
  render() {
    return (
      <Box style={this.props.style ? {..._toggleContainer, ...this.props.style} : _toggleContainer}>
        <ClickableBox onClick={this.props.toggle} className="toggleButtonClass" style={_toggleButtonStyle}>
          <Text type="BodySmallSemibold" style={_textStyle}>
            {this.props.hiddenCount > 0 ? `+${this.props.hiddenCount} more` : 'Show less'}
          </Text>
          {this.props.hiddenCount > 0 &&
            this.props.badgeCount > 0 && (
              <Badge badgeStyle={_badgeToggleStyle} badgeNumber={this.props.badgeCount} />
            )}
        </ClickableBox>
        <Box style={_dividerStyle} />
      </Box>
    )
  }
}

const _textStyle = {
  color: globalColors.black_60,
}
const _toggleButtonStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  alignSelf: 'center',
  backgroundColor: globalColors.black_05_on_white,
  borderRadius: 19,
  height: isMobile ? 28 : 20,
  marginBottom: isMobile ? 16 : 8,
  paddingLeft: isMobile ? globalMargins.small : globalMargins.tiny,
  paddingRight: isMobile ? globalMargins.small : globalMargins.tiny,
}

const _badgeStyle = {
  marginLeft: globalMargins.xtiny,
  marginRight: 0,
  position: 'relative',
}

const _dividerStyle = {
  backgroundColor: globalColors.black_05_on_white,
  height: 1,
  width: '100%',
}

const _toggleContainer = {
  ...globalStyles.flexBoxColumn,
  height: isMobile ? 56 : 40,
  justifyContent: 'center',
}

const _badgeToggleStyle = {
  ..._badgeStyle,
  marginLeft: globalMargins.xtiny,
}

export {Divider}
