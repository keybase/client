import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import {Box2, Text} from '../../../common-adapters'
import {globalColors} from '../../../styles'
import chooseEmoji from './react-button/emoji-picker/index.stories'
import emojiRow from './react-button/emoji-row/index.stories'
import placeholder from './placeholder/index.stories'
import reactButton from './react-button/index.stories'
import wrapper from './wrapper/index.stories'
import reactionTooltip from './reaction-tooltip/index.stories'
import text from './text/index.stories'
import accountPayment from './account-payment/index.stories'
import UserNotice from './user-notice'
import coinflip from './coinflip/index.stories'
import gitPush from './system-git-push/index.stories'
import systemText from './system-text/index.stories'

const load = () => {
  ;[
    chooseEmoji,
    coinflip,
    emojiRow,
    placeholder,
    reactButton,
    reactionTooltip,
    text,
    accountPayment,
    wrapper,
    gitPush,
    systemText,
  ].forEach(load => load())
  Sb.storiesOf('Chat', module)
    .addDecorator(story => (
      <Box2 direction="vertical" style={{maxWidth: 600}}>
        {story()}
      </Box2>
    ))
    .add('UserNotice blank', () => (
      <UserNotice bgColor={globalColors.blueLighter2}>
        <Text type="BodySmall">Some generic notice</Text>
      </UserNotice>
    ))
    .add('UserNotice blank team', () => (
      <UserNotice bgColor={globalColors.blueLighter2} teamname="">
        <Text type="BodySmall">Some team notice</Text>
      </UserNotice>
    ))
    .add('UserNotice blank user', () => (
      <UserNotice bgColor={globalColors.blueLighter2} username="">
        <Text type="BodySmall">Some user notice</Text>
      </UserNotice>
    ))
}

export default load
