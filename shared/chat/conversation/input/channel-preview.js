// @flow
import React from 'react'
import {Box, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import {type Props} from '.'

export default class ChannelPreview extends React.Component<Props> {
  render() {
    return (
      <Box style={styleContainer}>
        <Text type="BodySemibold" backgroundMode="Announcements">
          Would you like to join #{this.props.channelName}?
        </Text>
        <Text type="BodySemiboldLink" backgroundMode="Announcements" onClick={this.props.onJoinChannel}>
          Yes, join
        </Text>
      </Box>
    )
  }
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.blue,
  paddingTop: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
}
