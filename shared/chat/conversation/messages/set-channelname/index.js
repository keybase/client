// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'

type Props = {
  message: Types.MessageSetChannelname,
}

export default (props: Props) => (
  <Kb.Text type="BodySmall">
    set the channel name to <Kb.Text type="BodySmallItalic">#{props.message.newChannelname}</Kb.Text>
  </Kb.Text>
)
