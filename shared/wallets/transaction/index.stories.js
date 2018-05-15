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

const singleEmojiNote = '🎁'
const shortNote = 'Short note.'
const longNote =
  'Stellar deal!! You guys rock. This is to show a very long private note. Blah blah blah blah. Plus, emojis. 🍺'

const addConfigs = (stories, namePrefix, storyFn) => {
  const roles = [{yourRole: 'sender'}, {yourRole: 'receiver'}]
  const sizes = [{large: true}, {large: false}]
  const notesAndTimes = [
    {note: shortNote, timestamp: yesterday},
    {note: longNote, timestamp: lastWeek},
    {note: singleEmojiNote, timestamp: beforeLastWeek},
    // Pending.
    {note: shortNote, timestamp: null},
  ]

  roles.forEach(r => {
    sizes.forEach(s => {
      stories.add(namePrefix + ` (${r.yourRole} - ${s.large ? 'large' : 'small'})`, () => {
        const components = []
        notesAndTimes.forEach(t => {
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
  addConfigs(stories, 'Wallet', config => (
    <Transaction
      counterparty="Second wallet"
      counterpartyType="wallet"
      amountUser="$100"
      amountXLM="545.2562704 XLM"
      {...config}
    />
  ))
}

export default load
