// @flow
import * as React from 'react'
import moment from 'moment'
import * as PropProviders from '../../stories/prop-providers'
import {Box2} from '../../common-adapters'
import {storiesOf} from '../../stories/storybook'
import TransactionDetails from '.'

const provider = PropProviders.compose(
  PropProviders.Usernames(['paul'], 'john'),
  PropProviders.Avatar(['following', 'both'], ['followers', 'both'])
)

const now = new Date()
const yesterday = moment(now)
  .subtract(1, 'days')
  .toDate()

const memo =
  'Stellar deal!! You guys rock. This is to show a very long private note. Blah blah blah blah. Plus, emojis. 🍺'

const addConfigs = (stories, namePrefix, storyFn) => {
  roles.forEach(r => {
      stories.add(namePrefix + ` (${r.yourRole} - large)`, () => {
        const components = []
        memosAndTimes.forEach(t => {
          components.push(storyFn({key: components.length, ...r, ...t}))
        })
        return components
      })
    })
}

const load = () => {
  storiesOf('Wallets/Transaction Details', module)
    .addDecorator(provider)
    .addDecorator(story => (
      <Box2 direction="vertical" style={{maxWidth: 520}}>
        {story()}
      </Box2>
    ))
    .add('Sending to Keybase user', () =>
    <TransactionDetails
      counterparty="paul"
      counterpartyType="keybaseUser"
      amountUser="$12.50"
      amountXLM="53.1688643 XLM"
      yourRole="sender"
      memo={memo}
      timestamp={yesterday}
    />
  ).add('Sending to Stellar public key', () =>
    <TransactionDetails
      counterparty="G43289XXXXX34OPL"
      counterpartyType="stellarPublicKey"
      amountUser="$15.65"
      amountXLM="42.535091 XLM"
      yourRole="sender"
      memo={memo}
      timestamp={yesterday}
      large={true}
    />
).add('Sending to Keybase user (pending)', () =>
    <TransactionDetails
      counterparty="Second wallet"
      counterpartyType="wallet"
      amountUser="$100"
      amountXLM="545.2562704 XLM"
      yourRole="sender"
      memo={memo}
      timestamp={null}
      large={true}
    />
  ).add('Received from Keybase user (pending)', () =>
    <TransactionDetails
      counterparty="Second wallet"
      counterpartyType="wallet"
      amountUser="$100"
      amountXLM="545.2562704 XLM"
      yourRole="receiver"
      memo={memo}
      timestamp={yesterday}
      large={true}
    />
  )
}

export default load
