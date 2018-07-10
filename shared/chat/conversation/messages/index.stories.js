// @flow
import placeholder from './placeholder/index.stories'
import reactionTooltip from './reaction-tooltip/index.stories'
import text from './text/index.stories'
import walletPayment from './wallet-payment/index.stories'

const load = () => {
  ;[placeholder, reactionTooltip, text, walletPayment].forEach(load => load())
}

export default load
