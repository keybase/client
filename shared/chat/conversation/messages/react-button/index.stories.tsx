import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as Sb from '../../../../stories/storybook'
import {Box} from '../../../../common-adapters'
import {OwnProps, WrapperProps} from './container'
import ReactButton, {NewReactionButton} from '.'

// Common props for these stories and fallbacks for the prop provider
const common = {
  conversationIDKey: Constants.noConversationIDKey,
  onMouseLeave: Sb.action('onMouseLeave'),
  onMouseOver: Sb.action('onMouseOver'),
  ordinal: Types.numberToOrdinal(0),
}

// Mapper is the same for version w/ and w/out tooltip
// Include both display names in the provider
const propMapper = (props: OwnProps): WrapperProps => ({
  ...common,
  active: !!props.emoji && [':face_with_cowboy_hat:', ':honey_pot:'].includes(props.emoji),
  count:
    {':+1:': 2, ':face_with_cowboy_hat:': 1, ':honey_pot:': 12, default: 1}[props.emoji || 'default'] || 1,
  emoji: props.emoji || '',
  onAddReaction: Sb.action('onAddReaction'),
  onClick: Sb.action('onReact'),
  onMouseLeave: props.onMouseLeave || common.onMouseLeave,
  onMouseOver: props.onMouseOver || common.onMouseOver,
  onOpenEmojiPicker: Sb.action('onOpenEmojiPicker'),
  showBorder: props.showBorder,
})
export const propProvider = {
  ReactButton: propMapper,
  ReactButtonWithTooltip: propMapper,
}

const examples = [
  {
    ...common,
    active: false,
    count: 1,
    emoji: ':+1:',
    onClick: Sb.action('onClick'),
  },
  {
    ...common,
    active: true,
    count: 4,
    emoji: ':face_with_cowboy_hat:',
    onClick: Sb.action('onClick'),
  },
]

const load = () => {
  const story = Sb.storiesOf('Chat/Conversation/React Button', module).addDecorator(story => (
    <Box style={{display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', padding: 24}}>
      {story()}
    </Box>
  ))
  examples.forEach(ex => story.add(`${ex.emoji}${ex.active ? ' active' : ''}`, () => <ReactButton {...ex} />))
  story.add('New reaction', () => (
    <NewReactionButton
      onAddReaction={Sb.action('onAddReaction')}
      onOpenEmojiPicker={Sb.action('onOpenEmojiPicker')}
      showBorder={true}
    />
  ))
}

export default load
