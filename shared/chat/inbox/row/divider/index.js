// @flow
import * as React from 'react'
import {ClickableBox, Box, Text, Badge} from '../../../../common-adapters'
import {globalStyles, globalColors, globalMargins, isMobile} from '../../../../styles'

type Props = {
  badgeCount: number,
  hiddenCount: number,
  style?: any,
  showSmallTeamsExpandDivider: boolean,
  toggle: () => void,
}

class Divider extends React.PureComponent<Props> {
  render() {
    return (
      <Box style={this.props.style ? {..._toggleContainer, ...this.props.style} : _toggleContainer}>
        {this.props.showSmallTeamsExpandDivider && (
          <ClickableBox onClick={this.props.toggle} className="toggleButtonClass" style={_toggleButtonStyle}>
            <Text type="BodySmallSemibold" style={_textStyle}>
              {this.props.hiddenCount > 0 ? `+${this.props.hiddenCount} more` : 'Show less'}
            </Text>
            {this.props.hiddenCount > 0 &&
              this.props.badgeCount > 0 && (
                <Badge badgeStyle={_badgeToggleStyle} badgeNumber={this.props.badgeCount} />
              )}
          </ClickableBox>
        )}
        <Box style={_dividerStyle} />
        {!this.props.showSmallTeamsExpandDivider && (
          <Text type="BodySmallSemibold" style={{padding: `4px ${globalMargins.tiny}px`}}>
            Big teams
          </Text>
        )}
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
  backgroundColor: globalColors.black_05,
  borderRadius: 19,
  height: isMobile ? 28 : 20,
  paddingLeft: isMobile ? globalMargins.small : globalMargins.tiny,
  paddingRight: isMobile ? globalMargins.small : globalMargins.tiny,
}

const _badgeStyle = {
  marginLeft: globalMargins.xtiny,
  marginRight: 0,
  position: 'relative',
}

const _dividerStyle = {
  backgroundColor: globalColors.black_05,
  height: 1,
  marginTop: isMobile ? 16 : 8,
  width: '100%',
}

const _toggleContainer = {
  ...globalStyles.flexBoxColumn,
  height: isMobile ? 56 : 'auto',
  justifyContent: 'center',
}

const _badgeToggleStyle = {
  ..._badgeStyle,
  marginLeft: globalMargins.xtiny,
}

export {Divider}
