import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import Participants from '.'
import {stringToAccountID} from '../../../constants/types/wallets'

const provider = Sb.createPropProviderWithCommon()

const defaultProps = {
  fromAccountAssets: '2000 XLM',
  fromAccountIsDefault: true,
  fromAccountName: 'Primary Account',
  recipientAccountAssets: '123 XLM',
  recipientAccountIsDefault: false,
  recipientAccountName: 'Secondary Account',
  recipientFullName: 'Addie Stokes',
  recipientStellarAddress: stringToAccountID('GBQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I4'),
  recipientUsername: 'yen',
  yourUsername: 'cjb',
}

const load = () => {
  Sb.storiesOf('Wallets/ConfirmForm/Participants', module)
    .addDecorator(provider)
    .add('To Keybase user', () => <Participants {...defaultProps} recipientType="keybaseUser" />)
    .add('To other account', () => <Participants {...defaultProps} recipientType="otherAccount" />)
    .add('To stellar address', () => <Participants {...defaultProps} recipientType="stellarPublicKey" />)
}

export default load
