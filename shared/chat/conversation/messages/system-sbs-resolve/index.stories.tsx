import * as React from 'react'
import * as Constants from '../../../../constants/chat2/message'
import * as Sb from '../../../../stories/storybook'
import SBSProvedNotice from '.'

const rooter = Constants.makeMessageSystemSBSResolved({
  assertionService: 'twitter',
  assertionUsername: 'michal',
  prover: 'zapu',
  timestamp: new Date('1/1/2000').getTime(),
})

const github = Constants.makeMessageSystemSBSResolved({
  assertionService: 'github',
  assertionUsername: 'michal',
  prover: 'zapu',
  timestamp: new Date('1/1/2000').getTime(),
})

const phone = Constants.makeMessageSystemSBSResolved({
  assertionService: 'phone',
  assertionUsername: '12015550123',
  prover: 'zapu',
  timestamp: new Date('1/1/2000').getTime(),
})

const email = Constants.makeMessageSystemSBSResolved({
  assertionService: 'email',
  assertionUsername: 'michal@keybase.io',
  prover: 'zapu',
  timestamp: new Date('1/1/2000').getTime(),
})

const load = () => {
  Sb.storiesOf('Chat/Conversation/Rows/SBS', module)
    .add('Rooter', () => <SBSProvedNotice message={rooter} you="alice" />)
    .add('GitHub', () => <SBSProvedNotice message={github} you="alice" />)
    .add('Phone', () => <SBSProvedNotice message={phone} you="alice" />)
    .add('Email', () => <SBSProvedNotice message={email} you="alice" />)
    .add('Self rooter', () => <SBSProvedNotice message={rooter} you="zapu" />)
    .add('Self GitHub', () => <SBSProvedNotice message={github} you="zapu" />)
    .add('Self phone', () => <SBSProvedNotice message={phone} you="zapu" />)
    .add('Self email', () => <SBSProvedNotice message={email} you="zapu" />)
}

export default load
