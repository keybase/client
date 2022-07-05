import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Sb from '../../../stories/storybook'

import CommandMarkdown from './index'

const props = {
  body: `Current Flip: *HEADS* or *TAILS*

Example commands:
    /flip          coin flip
    /flip 6        roll a 6-sided die (1..6)
    /flip 10..20   pick a number 10 to 20 (inclusive)
    /flip a,b,c,d  shuffle some options and pick where to eat or whom to wrestle
    /flip cards    shuffle and deal a deck

And for a quick game of face-up poker:
    /flip cards 5 @user1 @user2 @user3
        (shuffle a deck and deal 5 cards to 3 different people

The blog post announcing this feature and how it works:
    https://keybase.io/coin-flipping
`,
  title: `*/flip* [options]
Flip a cryptographic coin
`,
}

const load = () => {
  Sb.storiesOf('Chat/Conversation/CommandMarkdown', module)
    .addDecorator(story => <Kb.Box style={{maxWidth: 600, padding: 5}}>{story()}</Kb.Box>)
    .add('Display', () => <CommandMarkdown {...props} />)
}

export default load
