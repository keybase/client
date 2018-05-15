// @flow
import * as React from 'react'
import moment from 'moment'
import * as PropProviders from '../../stories/prop-providers'
import {Box2} from '../../common-adapters'
import {storiesOf} from '../../stories/storybook'
import Transaction from '.'

const provider = PropProviders.compose(PropProviders.Usernames(['paul'], 'john'))

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

const shortNote = 'Short note.'
const longNote =
  'Stellar deal!! You guys rock. This is to show a very long private note. Blah blah blah blah. Plus, emojis. 🍺'

const makeConfigs = () => {
  const roles = [{yourRole: 'sender'}, {yourRole: 'receiver'}]
  const times = [
    {timestamp: yesterday},
    {timestamp: lastWeek},
    {timestamp: beforeLastWeek},
    {timestamp: null},
  ]
  const notes = [{note: shortNote}, {note: longNote}]
  const sizes = [{large: true}, {large: false}]

  const configs = []
  roles.forEach(r => {
    times.forEach(t => {
      notes.forEach(n => {
        sizes.forEach(s => {
          configs.push({...r, ...t, ...n, ...s})
        })
      })
    })
  })
  return configs
}

const configs = makeConfigs()

const load = () => {
  storiesOf('Wallets/Transaction', module)
    .addDecorator(provider)
    .addDecorator(story => (
      <Box2 direction="vertical" style={{maxWidth: 520}}>
        {story()}
      </Box2>
    ))
    .add('Keybase User', () =>
      configs.map((config, i) => (
        <Transaction
          key={i}
          counterparty="paul"
          counterpartyType="keybaseUser"
          amountUser="$12.50"
          amountXLM="53.1688643 XLM"
          {...config}
        />
      ))
    )
    .add('Stellar Public Key', () =>
      configs.map((config, i) => (
        <Transaction
          key={i}
          counterparty="G43289XXXXX34OPL"
          counterpartyType="stellarPublicKey"
          amountUser="$12.50"
          amountXLM="53.1688643 XLM"
          {...config}
        />
      ))
    )
    .add('Wallet', () =>
      configs.map((config, i) => (
        <Transaction
          key={i}
          counterparty="Second wallet"
          counterpartyType="wallet"
          amountUser="$12.50"
          amountXLM="53.1688643 XLM"
          {...config}
        />
      ))
    )
}

export default load
