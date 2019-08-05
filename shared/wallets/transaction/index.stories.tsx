import * as React from 'react'
import * as Sb from '../../stories/storybook'
import moment from 'moment'
import {Box2} from '../../common-adapters'
import {platformStyles, styleSheetCreate} from '../../styles'
import {Transaction} from '.'

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
      onCancelPayment: null,
      status: 'completed',
      statusDetail: '',
    },
    {
      onCancelPayment: null,
      status: 'error',
      statusDetail: 'Horizon error',
    },
    {
      onCancelPayment: Sb.action('onCancelPayment'),
      status: 'error',
      statusDetail: 'Horizon error',
    },
  ]
  const memosAndTimes = [
    // No memo.
    {amountUser: '$12.50', amountXLM: '53.1688643 XLM', memo: '', timestamp: yesterday},
    {amountUser: '$12.50', amountXLM: '53.1688643 XLM', memo: shortMemo, timestamp: yesterday},
    {amountUser: '$15.65', amountXLM: '42.535091 XLM', memo: longMemo, timestamp: lastWeek},
    // No display currency.
    {amountUser: '', amountXLM: '19.4567588 XLM', memo: singleEmojiMemo, timestamp: beforeLastWeek},
  ]
  const readStates = [{readState: 'read'}, {readState: 'unread'}, {readState: 'oldestUnread'}]

  // NOTE: Do not add another layer of `forEach` to this; storyshots may hang
  roles.forEach(r => {
    stories.add(`${namePrefix} (${r.yourRole})`, () => {
      const components: Array<any> = []
      statuses.forEach(st => {
        memosAndTimes.forEach(mt => {
          readStates.forEach(rs => {
            // a non-complete transaction is already treated as 'unread'.
            if (st.status !== 'completed' && rs.readState === 'read') {
              return
            }
            components.push(
              storyFn({
                approxWorth: '',
                issuerDescription: '',
                ...r,
                ...st,
                ...mt,
                ...rs,
                key: components.length,
                onCancelPaymentWaitingKey: '',
                onSelectTransaction: Sb.action('onSelectTransaction'),
                onShowProfile: Sb.action('onShowProfile'),
                selectableText: false,
                sourceAmount: '',
                sourceAsset: '',
                unread: false,
              })
            )
          })
        })
      })
      return components
    })
  })
}

const styles = styleSheetCreate({
  container: platformStyles({
    isElectron: {
      maxWidth: 520,
    },
    isMobile: {
      width: '100%',
    },
  }),
})

const load = () => {
  const stories = Sb.storiesOf('Wallets/Transaction', module)
    .addDecorator(story => (
      <Box2 direction="vertical" style={styles.container}>
        {story()}
      </Box2>
    ))
    .addDecorator(Sb.scrollViewDecorator)
    .add('Airdrop', () => (
      <Transaction
        amountUser="$12.34 USD"
        approxWorth="$12.34 USD"
        amountXLM="20 XLM"
        counterparty=""
        counterpartyType="airdrop"
        fromAirdrop={true}
        isAdvanced={false}
        issuerDescription=""
        memo="1 XLM (Stellar Lumens) divided across 2 Keybase users."
        onCancelPayment={undefined}
        onCancelPaymentWaitingKey=""
        onSelectTransaction={Sb.action('onSelectTransaction')}
        onShowProfile={Sb.action('onShowProfile')}
        readState="read"
        selectableText={false}
        sourceAmount=""
        sourceAsset=""
        status="completed"
        statusDetail=""
        timestamp={new Date()}
        unread={false}
        yourRole="airdrop"
      />
    ))

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
  addConfigs(stories, 'Non-native asset', config => (
    <Transaction
      {...config}
      counterparty="G43289XXXXX34OPL"
      counterpartyType="stellarPublicKey"
      issuerDescription="example.com"
      amountXLM="53.1688643 HUGS"
      amountUser=""
    />
  ))
  addConfigs(stories, 'Advanced tx', config => (
    <Transaction
      {...config}
      counterparty=""
      counterpartyType="stellarPublicKey"
      isAdvanced={true}
      summaryAdvanced="Established trust line to WBEZ/GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C"
      operations={['Established trust line to WBEZ/GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C']}
    />
  ))
  addConfigs(stories, 'Advanced tx multi', config => (
    <Transaction
      {...config}
      counterparty=""
      counterpartyType="stellarPublicKey"
      isAdvanced={true}
      summaryAdvanced="Multi-operation transaction with 3 operations"
      operations={[
        'Established trust line to WBEZ/GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C',
        'Paid 1.0000000 XLM to account GA5MKLM3B2L4SXXXXFZAIX54KVUTEKIXRB2XOKAGYVTQMWD77AMKUD2G',
        'Set master key weight to 100',
      ]}
    />
  ))
  addConfigs(stories, 'Trustline add', config => (
    <Transaction
      {...config}
      counterparty=""
      counterpartyType="stellarPublicKey"
      isAdvanced={true}
      summaryAdvanced="Established trust line to WBEZ/GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C"
      operations={['Established trust line to WBEZ/GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C']}
      trustline={{
        asset: {
          code: 'WBEZ',
          issuer: 'GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C',
          verifiedDomain: 'strongmold.co',
        },
        remove: false,
      }}
    />
  ))
  addConfigs(stories, 'Trustline add (no issuer domain)', config => (
    <Transaction
      {...config}
      counterparty=""
      counterpartyType="stellarPublicKey"
      isAdvanced={true}
      summaryAdvanced="Established trust line to WBEZ/GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C"
      operations={['Established trust line to WBEZ/GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C']}
      trustline={{
        asset: {
          code: 'WBEZ',
          issuer: 'GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C',
          verifiedDomain: '',
        },
        remove: false,
      }}
    />
  ))
  addConfigs(stories, 'Trustline remove', config => (
    <Transaction
      {...config}
      counterparty=""
      counterpartyType="stellarPublicKey"
      isAdvanced={true}
      summaryAdvanced="Removed trust line to WBEZ/GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C"
      operations={['Removed trust line to WBEZ/GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C']}
      trustline={{
        asset: {
          code: 'WBEZ',
          issuer: 'GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C',
          verifiedDomain: 'strongmold.co',
        },
        remove: true,
      }}
    />
  ))
  addConfigs(stories, 'Trustline remove (no issuer domain)', config => (
    <Transaction
      {...config}
      counterparty=""
      counterpartyType="stellarPublicKey"
      isAdvanced={true}
      summaryAdvanced="Removed trust line to WBEZ/GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C"
      operations={['Removed trust line to WBEZ/GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C']}
      trustline={{
        asset: {
          code: 'WBEZ',
          issuer: 'GCKPQEBFEWJHDBUIW42XHWOHTVMTYQ73YJU6M4J5UD2QVUKUZBS5D55C',
          verifiedDomain: '',
        },
        remove: true,
      }}
    />
  ))
}

export default load
