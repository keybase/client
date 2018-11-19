// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import {Box2, Text} from '../../../common-adapters'
import {globalColors} from '../../../styles'
import chooseEmoji from './react-button/emoji-picker/index.stories'
import placeholder from './placeholder/index.stories'
import reactButton from './react-button/index.stories'
import reactionTooltip from './reaction-tooltip/index.stories'
import text from './text/index.stories'
import accountPayment from './account-payment/index.stories'
import unfurl from './unfurl/index.stories'
import UserNotice from './user-notice'

const load = () => {
  ;[chooseEmoji, placeholder, reactButton, reactionTooltip, text, accountPayment, unfurl].forEach(load =>
    load()
  )
  Sb.storiesOf('Chat', module)
    .addDecorator(story => (
      <Box2 direction="vertical" style={{maxWidth: 600}}>
        {story()}
      </Box2>
    ))
    .add('UserNotice', () => (
      <UserNotice bgColor={globalColors.blue4}>
        <Text type="BodySmall">Some user notice</Text>
      </UserNotice>
    ))
}

export default load
