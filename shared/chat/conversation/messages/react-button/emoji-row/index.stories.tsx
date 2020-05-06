import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Sb from '../../../../../stories/storybook'
import * as Styles from '../../../../../styles'
import * as Constants from '../../../../../constants/chat2'
import EmojiRow from '.'

const common = {
  className: 'emoji-row',
  emojis: Constants.defaultTopReacjis,
  onForward: Sb.action('onForward'),
  onReact: Sb.action('onReact'),
  onReply: Sb.action('onReply'),
  onShowingEmojiPicker: Sb.action('onShowingEmojiPicker'),
}

const HideShowBox = Styles.styled(Kb.Box2)(() => ({
  '& .emoji-row': {visibility: 'hidden'},
  '&:hover .emoji-row': {visibility: 'visible'},
  position: 'relative',
}))

const FakeMessage = () => (
  <HideShowBox direction="horizontal" style={{backgroundColor: 'pink', padding: 4, width: 500}}>
    <Kb.Text type="HeaderExtrabold" style={{...Styles.globalStyles.italic}}>
      1-800-FAKEMESSAGE
    </Kb.Text>
    <EmojiRow
      {...common}
      style={{bottom: -20, position: 'absolute', right: 100}}
      conversationIDKey={Constants.noConversationIDKey}
      ordinal={0}
    />
  </HideShowBox>
)

const load = () =>
  Sb.storiesOf('Chat/Conversation/Emoji row', module)
    .add('On hover', () => <FakeMessage />)
    .add('Visible', () => (
      <EmojiRow {...common} conversationIDKey={Constants.noConversationIDKey} ordinal={0} />
    ))

export default load
