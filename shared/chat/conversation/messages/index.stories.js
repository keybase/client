// @flow
import chooseEmoji from './react-button/emoji-picker/index.stories'
import placeholder from './placeholder/index.stories'
import reactButton from './react-button/index.stories'
import reactionTooltip from './reaction-tooltip/index.stories'
import text from './text/index.stories'
import accountPayment from './account-payment/index.stories'

const load = () => {
  ;[chooseEmoji, placeholder, reactButton, reactionTooltip, text, accountPayment].forEach(load => load())
}

export default load
