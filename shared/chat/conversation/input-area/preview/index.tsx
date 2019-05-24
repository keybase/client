import React from 'react'
import {Box, Box2, Text} from '../../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../../styles'

type Props = {
  channelname: string
  onJoinChannel: () => void
  onLeaveChannel: () => void
}

type State = {
  clicked: null | 'join' | 'leave'
}

export default class ChannelPreview extends React.Component<Props, State> {
  state = {clicked: null}
  _onClick = join =>
    this.setState(
      {clicked: join ? 'join' : 'leave'},
      join ? this.props.onJoinChannel : this.props.onLeaveChannel
    )
  render() {
    return (
      <Box style={styleContainer}>
        <Text type="BodySemibold" negative={true}>
          Would you like to join #{this.props.channelname}?
        </Text>
        {!this.state.clicked && (
          <Box2 direction="horizontal" gap="tiny">
            <Text type="BodySemiboldLink" negative={true} onClick={() => this._onClick(true)}>
              Yes, join
            </Text>
            <Text type="BodySemiboldLink" negative={true} onClick={() => this._onClick(false)}>
              No, thanks
            </Text>
          </Box2>
        )}
        {!!this.state.clicked && (
          <Text type="BodySemibold" negative={true}>
            {this.state.clicked === 'join' ? 'Joining...' : 'Leaving...'}
          </Text>
        )}
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
