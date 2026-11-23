import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import * as TestIDs from '@/tests/e2e/shared/test-ids'

// Stellar payments are no longer supported: a payment message is shown as static text.
const PaymentMessage = (p: {message: T.Chat.MessageSendPayment | T.Chat.MessageRequestPayment}) => {
  const {message} = p
  const what = message.type === 'sendPayment' ? 'Payment sent.' : 'Payment requested.'
  return (
    <Kb.Box2 direction="vertical" testID={TestIDs.CHAT_PAYMENT}>
      <Kb.Text type="BodySmall" selectable={true}>
        {what} Stellar transactions are no longer supported in the Keybase app.
      </Kb.Text>
    </Kb.Box2>
  )
}

export default PaymentMessage
