// @flow
import * as React from 'react'
import * as MessageTypes from '../../../../constants/types/chat2/message'
import {Box2} from '../../../../common-adapters'
import ReactButton from '../react-button/container'

export type Props = {
  emojis: Array<string>,
  messageID: MessageTypes.MessageID,
}

const ReactionsRow = (props: Props) => (
  <Box2 direction="horizontal" gap="tiny">
    {props.emojis.map(emoji => <ReactButton key={emoji} emoji={emoji} messageID={props.messageID} />)}
  </Box2>
)

export default ReactionsRow
