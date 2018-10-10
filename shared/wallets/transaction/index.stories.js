// @flow
import * as React from 'react'
import * as Sb from '../../stories/storybook'
import moment from 'moment'
import {Box2} from '../../common-adapters'
import Transaction from '.'

const now = new Date()
const yesterday = moment(now)
  .subtract(1, 'days')
  .toDate()
const lastWeek = moment(now)
  .subtract(6, 'days')
  .toDate()
const beforeLastWeek = moment(now)
  .subtract(8, 'days')
  .toDate()

const singleEmojiMemo = '🎁'
const shortMemo = 'Short memo.'
const longMemo =
  'Stellar deal!! You guys rock. This is to show a very long private note. Blah blah blah blah. Plus, emojis. 🍺'

const addConfigs = (stories, namePrefix, storyFn) => {
  const roles = [{yourRole: 'senderOnly'}, {yourRole: 'senderAndReceiver'}, {yourRole: 'receiverOnly'}]
  const sizes = [{large: true}, {large: false}]
  const memosAndTimes = [
    {memo: shortMemo, timestamp: yesterday},
    {memo: longMemo, timestamp: lastWeek},
    {memo: singleEmojiMemo, timestamp: beforeLastWeek},
    // Pending.
    {memo: shortMemo, timestamp: null},
  ]
  const readStates = [{readState: 'read'}, {readState: 'unread'}, {readState: 'oldestUnread'}]

  roles.forEach(r => {
    sizes.forEach(s => {
      stories.add(namePrefix + ` (${r.yourRole} - ${s.large ? 'large' : 'small'})`, () => {
        const components = []
        let first = true
        memosAndTimes.forEach(t => {
          const localReadStates = first ? readStates : readStates.slice(0, 1)
          first = false
          localReadStates.forEach(rs => {
            components.push(
              storyFn({
                key: components.length,
                ...r,
                ...s,
                ...t,
                ...rs,
                onCancelPayment: null,
                onCancelPaymentWaitingKey: '',
                onSelectTransaction: Sb.action('onSelectTransaction'),
                onShowProfile: Sb.action('onShowProfile'),
                selectableText: false,
              })
            )
          })
        })
        return components
      })
    })
  })
}

const load = () => {
  const stories = Sb.storiesOf('Wallets/Transaction', module).addDecorator(story => (
    <Box2 direction="vertical" style={{maxWidth: 520}}>
      {story()}
    </Box2>
  ))

  addConfigs(stories, 'Keybase User', config => (
    <Transaction
      {...config}
      counterparty="paul"
      counterpartyType="keybaseUser"
      amountUser="$12.50"
      amountXLM="53.1688643 XLM"
      status="completed"
      statusDetail=""
    />
  ))
  addConfigs(stories, 'Stellar Public Key', config => (
    <Transaction
      {...config}
      counterparty="G43289XXXXX34OPL"
      counterpartyType="stellarPublicKey"
      amountUser="$15.65"
      amountXLM="42.535091 XLM"
      status="completed"
      statusDetail=""
    />
  ))
  addConfigs(stories, 'Account', config => (
    <Transaction
      {...config}
      counterparty="Second account"
      counterpartyType="otherAccount"
      amountUser="$100"
      amountXLM="545.2562704 XLM"
      status="completed"
      statusDetail=""
    />
  ))
  addConfigs(stories, 'No display currency', config => (
    <Transaction
      {...config}
      counterparty="peter"
      counterpartyType="keybaseUser"
      amountUser=""
      amountXLM="19.4567588 XLM"
      status="completed"
      statusDetail=""
    />
  ))
  addConfigs(stories, 'Keybase User - error', config => (
    <Transaction
      {...config}
      counterparty="paul"
      counterpartyType="keybaseUser"
      amountUser="$12.50"
      amountXLM="53.1688643 XLM"
      status="error"
      statusDetail="Horizon error"
    />
  ))
  addConfigs(stories, 'Keybase User - error with retry and cancel', config => (
    <Transaction
      {...config}
      counterparty="paul"
      counterpartyType="keybaseUser"
      amountUser="$12.50"
      amountXLM="53.1688643 XLM"
      status="error"
      statusDetail="Horizon error"
      onCancelPayment={Sb.action('onCancelPayment')}
      onRetryPayment={Sb.action('onRetryPayment')}
    />
  ))
  addConfigs(stories, 'Keybase user - cancelable', config => (
    <Transaction
      {...config}
      counterparty="paul"
      counterpartyType="keybaseUser"
      amountUser="$12.50"
      amountXLM="53.1688643 XLM"
      status="cancelable"
      statusDetail="Waiting for someone to claim"
      onCancelPayment={Sb.action('onCancelPayment')}
    />
  ))
}

export default load
