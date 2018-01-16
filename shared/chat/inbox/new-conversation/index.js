// @flow
import * as React from 'react'
import {Box, Text, Icon} from '../../../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../../../styles'

type Props = {
  users: Array<string>,
}

const containerStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.blue,
  flexShrink: 0,
  minHeight: 56,
}

const container2Style = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
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

class NewConversation extends React.PureComponent<Props> {
  render() {
    return (
      <Box style={containerStyle}>
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
            <Text style={{color: globalColors.white}} type="BodySemibold">
              {this.props.users.join(',')}
            </Text>
          ) : (
            <Text style={{color: globalColors.white}} type="BodySemibold">
              New conversation
            </Text>
          )}
        </Box>
      </Box>
    )
  }
}

export default NewConversation
