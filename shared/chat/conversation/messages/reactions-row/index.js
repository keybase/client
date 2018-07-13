// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Box2} from '../../../../common-adapters'
import ReactButton from '../react-button/container'
import {styleSheetCreate} from '../../../../styles'

export type Props = {
  emojis: Array<string>,
  messageID: Types.MessageID,
}

const ReactionsRow = (props: Props) => (
  <Box2 direction="horizontal" gap="tiny" fullWidth={true} style={styles.container}>
    {props.emojis.map(emoji => <ReactButton key={emoji} emoji={emoji} messageID={props.messageID} />)}
  </Box2>
)

const styles = styleSheetCreate({
  container: {
    alignItems: 'flex-start',
    marginLeft: 56,
  },
})

export default ReactionsRow
