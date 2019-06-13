import * as React from 'react'
import * as Kb from '../../../common-adapters'
import FromField from './from-field'
import {
  ToKeybaseUserProps,
  ToKeybaseUser,
  ToStellarPublicKeyProps,
  ToStellarPublicKey,
  ToOtherAccount,
} from './to-field'
import {AccountID} from '../../../constants/types/wallets'

const ParticipantsKeybaseUser = (props: ToKeybaseUserProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <ToKeybaseUser {...props} />
  </Kb.Box2>
)

const ParticipantsStellarPublicKey = (props: ToStellarPublicKeyProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <ToStellarPublicKey {...props} />
  </Kb.Box2>
)

export type Account = {
  contents: string
  name: string
  id: AccountID
  isDefault: boolean
  unknown?: boolean
}

type ParticipantsOtherAccountProps = {
  user: string
  fromAccount: Account
  toAccount?: Account
  allAccounts: Account[]
  onChangeFromAccount: (accountID: AccountID) => void
  onChangeRecipient: (recipient: string) => void
  onLinkAccount: () => void
  onCreateNewAccount: () => void
  showSpinner: boolean
}

const ParticipantsOtherAccount = (props: ParticipantsOtherAccountProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    <FromField
      initialAccount={props.fromAccount}
      accounts={props.allAccounts}
      onChangeSelectedAccount={props.onChangeFromAccount}
      user={props.user}
    />
    <ToOtherAccount
      user={props.user}
      toAccount={props.toAccount}
      allAccounts={props.allAccounts}
      onChangeRecipient={props.onChangeRecipient}
      onLinkAccount={props.onLinkAccount}
      showSpinner={props.showSpinner}
      onCreateNewAccount={props.onCreateNewAccount}
    />
  </Kb.Box2>
)

export {ParticipantsKeybaseUser, ParticipantsStellarPublicKey, ParticipantsOtherAccount}
