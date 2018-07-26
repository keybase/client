// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Box2} from '../../../../common-adapters'
import ReactButton from '../react-button/with-tooltip'
import {globalMargins, styleSheetCreate} from '../../../../styles'

export type Props = {|
  conversationIDKey: Types.ConversationIDKey,
  emojis: Array<string>,
  ordinal: Types.Ordinal,
|}

const ReactionsRow = (props: Props) =>
  props.emojis.length === 0 ? null : (
    <Box2 direction="horizontal" gap="xtiny" fullWidth={true} style={styles.container}>
      {props.emojis.map(emoji => (
        <ReactButton
          key={emoji}
          conversationIDKey={props.conversationIDKey}
          emoji={emoji}
          ordinal={props.ordinal}
          style={styles.button}
        />
      ))}
      <ReactButton
        conversationIDKey={props.conversationIDKey}
        ordinal={props.ordinal}
        showBorder={true}
        style={styles.button}
      />
    </Box2>
  )

const styles = styleSheetCreate({
  button: {marginBottom: globalMargins.tiny},
  container: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    marginLeft: 56,
    paddingRight: 50,
  },
})

export default ReactionsRow
