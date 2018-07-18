// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Box2} from '../../../../common-adapters'
import ReactButton from '../react-button/container'
import {styleSheetCreate} from '../../../../styles'

export type Props = {
  conversationIDKey: Types.ConversationIDKey,
  emojis: Array<string>,
  ordinal: Types.Ordinal,
}

const ReactionsRow = (props: Props) =>
  props.emojis.length === 0 ? null : (
    <Box2 direction="horizontal" gap="tiny" fullWidth={true} style={styles.container}>
      {props.emojis.map(emoji => (
        <ReactButton
          key={emoji}
          conversationIDKey={props.conversationIDKey}
          emoji={emoji}
          ordinal={props.ordinal}
        />
      ))}
    </Box2>
  )

const styles = styleSheetCreate({
  container: {
    alignItems: 'flex-start',
    marginLeft: 56,
  },
})

export default ReactionsRow
