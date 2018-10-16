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
  const statuses = [
    {
      status: 'completed',
      statusDetail: '',
      onCancelPayment: null,
    },
    {
      status: 'error',
      statusDetail: 'Horizon error',
      onCancelPayment: null,
    },
    {
      status: 'error',
      statusDetail: 'Horizon error',
      onCancelPayment: Sb.action('onCancelPayment'),
    },
    {
      status: 'error',
      statusDetail: 'Horizon error',
      onCancelPayment: Sb.action('onCancelPayment'),
      onRetryPayment: Sb.action('onRetryPayment'),
    },
  ]
  const memosAndTimes = [
    // No memo.
    {memo: '', timestamp: yesterday, amountUser: '$12.50', amountXLM: '53.1688643 XLM'},
    {memo: longMemo, timestamp: lastWeek, amountUser: '$15.65', amountXLM: '42.535091 XLM'},
    // No display currency.
    {memo: singleEmojiMemo, timestamp: beforeLastWeek, amountUser: '', amountXLM: '19.4567588 XLM'},
    // Pending.
    {memo: shortMemo, timestamp: null, amountUser: '$100', amountXLM: '545.2562704 XLM'},
  ]
  const readStates = [{readState: 'read'}, {readState: 'unread'}, {readState: 'oldestUnread'}]

  roles.forEach(r => {
    stories.add(`${namePrefix} (${r.yourRole})`, () => {
      const components = []
      let first = true
      statuses.forEach(st => {
        components.push(JSON.stringify(st))
        const localMemosAndTimes = first ? memosAndTimes : memosAndTimes.slice(0, 1)
        const localReadStates = first ? readStates : readStates.slice(0, 1)
        first = false
        localMemosAndTimes.forEach(mt => {
          localReadStates.forEach(rs => {
            components.push(
              storyFn({
                key: components.length,
                ...r,
                ...st,
                ...mt,
                ...rs,
                onCancelPaymentWaitingKey: '',
                onSelectTransaction: Sb.action('onSelectTransaction'),
                onShowProfile: Sb.action('onShowProfile'),
                selectableText: false,
              })
            )
          })
        })
      })
      return components
    })
  })
}

const load = () => {
  const stories = Sb.storiesOf('Wallets/Transaction', module)
    .addDecorator(story => (
      <Box2 direction="vertical" style={{maxWidth: 520}}>
        {story()}
      </Box2>
    ))
    .addDecorator(Sb.scrollViewDecorator)

  // Don't add new configs except for new counterparty types -- change
  // addConfigs instead.

  addConfigs(stories, 'Keybase User', config => (
    <Transaction {...config} counterparty="paul" counterpartyType="keybaseUser" />
  ))
  addConfigs(stories, 'Stellar Public Key', config => (
    <Transaction {...config} counterparty="G43289XXXXX34OPL" counterpartyType="stellarPublicKey" />
  ))
  addConfigs(stories, 'Account', config => (
    <Transaction {...config} counterparty="Second account" counterpartyType="otherAccount" />
  ))
}

export default load
