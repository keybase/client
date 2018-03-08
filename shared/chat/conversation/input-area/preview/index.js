// @flow
import React from 'react'
import {Box, Text} from '../../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../../styles'

type Props = {
  channelname: string,
  onJoinChannel: () => void,
  onLeaveChannel: () => void,
}

export default class ChannelPreview extends React.Component<Props> {
  render() {
    return (
      <Box style={styleContainer}>
        <Text type="BodySemibold" backgroundMode="Announcements">
          Would you like to join #{this.props.channelname}?
        </Text>
        <Box style={globalStyles.flexBoxRow}>
          <Text type="BodySemiboldLink" backgroundMode="Announcements" onClick={this.props.onJoinChannel}>
            Yes, join
          </Text>
          <Text
            type="BodySemiboldLink"
            style={{marginLeft: globalMargins.tiny}}
            backgroundMode="Announcements"
            onClick={this.props.onLeaveChannel}
          >
            No, thanks
          </Text>
        </Box>
      </Box>
    )
  }
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.blue,
  paddingBottom: globalMargins.tiny,
  paddingTop: globalMargins.tiny,
}
