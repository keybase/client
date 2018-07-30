// @flow
import * as React from 'react'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import {Box} from '../../../../common-adapters'
import {action, createPropProvider, storiesOf} from '../../../../stories/storybook'
import {Common} from '../../../../stories/prop-providers'
import {type OwnProps, type WrapperProps} from './container'
import ReactButton, {NewReactionButton} from '.'

// Tooltip includes avatars and usernames
const provider = createPropProvider(Common())

// Common props for these stories and fallbacks for the prop provider
const common = {
  conversationIDKey: Constants.noConversationIDKey,
  onMouseLeave: action('onMouseLeave'),
  onMouseOver: action('onMouseOver'),
  ordinal: Types.numberToOrdinal(0),
}

// Mapper is the same for version w/ and w/out tooltip
// Include both display names in the provider
const propMapper = (props: OwnProps): WrapperProps => ({
  ...common,
  active: [':face_with_cowboy_hat:', ':honey_pot:'].includes(props.emoji),
  count:
    {':+1:': 2, ':face_with_cowboy_hat:': 1, ':honey_pot:': 12, default: 1}[props.emoji || 'default'] || 1,
  emoji: props.emoji || '',
  onAddReaction: action('onAddReaction'),
  onClick: action('onReact'),
  onMouseLeave: props.onMouseLeave || common.onMouseLeave,
  onMouseOver: props.onMouseOver || common.onMouseOver,
  onOpenEmojiPicker: action('onOpenEmojiPicker'),
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
    onClick: action('onClick'),
  },
  {
    ...common,
    active: true,
    count: 4,
    emoji: ':face_with_cowboy_hat:',
    onClick: action('onClick'),
  },
]

const load = () => {
  const story = storiesOf('Chat/Conversation/React Button', module)
    .addDecorator(provider)
    .addDecorator(story => (
      <Box style={{display: 'flex', flexDirection: 'row', justifyContent: 'flex-start', padding: 24}}>
        {story()}
      </Box>
    ))
  examples.forEach(ex => story.add(`${ex.emoji}${ex.active ? ' active' : ''}`, () => <ReactButton {...ex} />))
  story.add('New reaction', () => (
    <NewReactionButton
      onAddReaction={action('onAddReaction')}
      onOpenEmojiPicker={action('onOpenEmojiPicker')}
      showBorder={true}
    />
  ))
}

export default load
