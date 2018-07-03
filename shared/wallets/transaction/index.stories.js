// @flow
import * as React from 'react'
import moment from 'moment'
import * as PropProviders from '../../stories/prop-providers'
import {Box2} from '../../common-adapters'
import {storiesOf} from '../../stories/storybook'
import Transaction from '.'

const provider = PropProviders.compose(
  PropProviders.Usernames(['paul'], 'john'),
  PropProviders.Avatar(['following', 'both'], ['followers', 'both'])
)

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
  const roles = [{yourRole: 'sender', delta: 'decrease'}, {yourRole: 'receiver', delta: 'increase'}]
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
          components.push(storyFn({key: components.length, ...r, ...s, ...t}))
        })
        return components
      })
    })
  })
}

const load = () => {
  const stories = storiesOf('Wallets/Transaction', module)
    .addDecorator(provider)
    .addDecorator(story => (
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
      {...config}
    />
  ))
  addConfigs(stories, 'Stellar Public Key', config => (
    <Transaction
      counterparty="G43289XXXXX34OPL"
      counterpartyType="stellarPublicKey"
      amountUser="$15.65"
      amountXLM="42.535091 XLM"
      {...config}
    />
  ))
  addConfigs(stories, 'Account', config => (
    <Transaction
      counterparty="Second account"
      counterpartyType="account"
      amountUser="$100"
      amountXLM="545.2562704 XLM"
      {...config}
    />
  ))
  addConfigs(stories, 'No display currency', config => (
    <Transaction
      counterparty="peter"
      counterpartyType="keybaseUser"
      amountUser=""
      amountXLM="19.4567588 XLM"
      {...config}
    />
  ))
}

export default load
