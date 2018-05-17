// @flow
import * as React from 'react'
import {Box, Text, Icon, ClickableBox} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins, desktopStyles} from '../../../styles'

type Props = {
  isSelected: boolean,
  users: Array<string>,
  onCancel: () => void,
  onClick: () => void,
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
            <Icon type="iconfont-people" color={globalColors.blue} fontSize={24} />
          </Box>
          <Box style={namesStyles1}>
            <Box style={namesStyles2}>
              {this.props.users.length ? (
                <Text
                  style={this.props.isSelected ? textSelectedStyle : textStyle}
                  type="BodySemibold"
                  lineClamp={1}
                >
                  {this.props.users.join(',')}
                </Text>
              ) : (
                <Text
                  style={this.props.isSelected ? textSelectedStyle : textStyle}
                  type="BodySemibold"
                  lineClamp={1}
                >
                  New conversation
                </Text>
              )}
            </Box>
          </Box>
          <Icon
            type="iconfont-remove"
            onClick={this.props.onCancel}
            color={globalColors.white}
            style={this.props.isSelected ? closeIconSelectedStyle : closeIconStyle}
          />
        </Box>
      </ClickableBox>
    )
  }
}

const namesStyles1 = {
  flex: 1,
  height: '100%',
  position: 'relative',
}

const namesStyles2 = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.fillAbsolute,
  alignItems: 'center',
  paddingRight: 4,
}

const containerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flexShrink: 0,
  minHeight: 56,
  width: '100%',
}

const containerSelectedStyle = {
  ...containerStyle,
  backgroundColor: globalColors.blue,
}

const container2Style = {
  ...globalStyles.flexBoxRow,
  ...desktopStyles.clickable,
  alignItems: 'center',
  paddingRight: 4,
  width: '100%',
}

const container3Style = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.blue3_40,
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

const closeIconStyle = {
  color: globalColors.black_20,
  marginRight: globalMargins.tiny,
}

const closeIconSelectedStyle = {
  ...closeIconStyle,
  color: globalColors.white,
}
export default NewConversation
