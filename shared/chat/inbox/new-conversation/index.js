// @flow
import * as React from 'react'
import {Box, Text, Icon, ClickableBox} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins, desktopStyles} from '../../../styles'

type Props = {
  isSelected: boolean,
  users: Array<string>,
  onClick: () => void,
}

const containerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  minHeight: 56,
}

const containerSelectedStyle = {
  ...containerStyle,
  backgroundColor: globalColors.blue,
}

const container2Style = {
  ...globalStyles.flexBoxRow,
  ...desktopStyles.clickable,
  alignItems: 'center',
}

const container3Style = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.blue2,
  borderRadius: globalMargins.large,
  height: globalMargins.large,
  justifyContent: 'center',
  marginLeft: globalMargins.tiny,
  marginRight: globalMargins.small,
  width: globalMargins.large,
}

const textStyle = {
  color: globalColors.darkBlue,
}
const textSelectedStyle = {
  ...textStyle,
  color: globalColors.white,
}

class NewConversation extends React.PureComponent<Props> {
  render() {
    return (
      <ClickableBox
        style={this.props.isSelected ? containerSelectedStyle : containerStyle}
        onClick={this.props.onClick}
      >
        <Box style={container2Style}>
          <Box style={container3Style}>
            <Icon
              type="iconfont-people"
              style={{
                color: globalColors.blue,
                fontSize: 24,
              }}
            />
          </Box>
          {this.props.users.length ? (
            <Text style={this.props.isSelected ? textSelectedStyle : textStyle} type="BodySemibold">
              {this.props.users.join(',')}
            </Text>
          ) : (
            <Text style={this.props.isSelected ? textSelectedStyle : textStyle} type="BodySemibold">
              New conversation
            </Text>
          )}
        </Box>
      </ClickableBox>
    )
  }
}

export default NewConversation
