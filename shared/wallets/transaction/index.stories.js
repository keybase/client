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

  roles.forEach(r => {
    sizes.forEach(s => {
      stories.add(namePrefix + ` (${r.yourRole} - ${s.large ? 'large' : 'small'})`, () => {
        const components = []
        memosAndTimes.forEach(t => {
          components.push(
            storyFn({
              key: components.length,
              ...r,
              ...s,
              ...t,
              onSelectTransaction: Sb.action('onSelectTransaction'),
              onShowProfile: Sb.action('onShowProfile'),
              selectableText: false,
            })
          )
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
      counterparty="paul"
      counterpartyType="keybaseUser"
      amountUser="$12.50"
      amountXLM="53.1688643 XLM"
      status="completed"
      statusDetail=""
      {...config}
    />
  ))
  addConfigs(stories, 'Stellar Public Key', config => (
    <Transaction
      counterparty="G43289XXXXX34OPL"
      counterpartyType="stellarPublicKey"
      amountUser="$15.65"
      amountXLM="42.535091 XLM"
      status="completed"
      statusDetail=""
      {...config}
    />
  ))
  addConfigs(stories, 'Account', config => (
    <Transaction
      counterparty="Second account"
      counterpartyType="otherAccount"
      amountUser="$100"
      amountXLM="545.2562704 XLM"
      status="completed"
      statusDetail=""
      {...config}
    />
  ))
  addConfigs(stories, 'No display currency', config => (
    <Transaction
      counterparty="peter"
      counterpartyType="keybaseUser"
      amountUser=""
      amountXLM="19.4567588 XLM"
      status="completed"
      statusDetail=""
      {...config}
    />
  ))
  addConfigs(stories, 'Keybase User - error', config => (
    <Transaction
      counterparty="paul"
      counterpartyType="keybaseUser"
      amountUser="$12.50"
      amountXLM="53.1688643 XLM"
      status="error"
      statusDetail="Horizon error"
      {...config}
    />
  ))
  addConfigs(stories, 'Keybase User - error with retry and cancel', config => (
    <Transaction
      counterparty="paul"
      counterpartyType="keybaseUser"
      amountUser="$12.50"
      amountXLM="53.1688643 XLM"
      status="error"
      statusDetail="Horizon error"
      onCancelPayment={Sb.action('onCancelPayment')}
      onRetryPayment={Sb.action('onRetryPayment')}
      {...config}
    />
  ))
}

export default load
