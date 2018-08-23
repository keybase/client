// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
// import * as Styles from '../../../styles'
import {AccountEntry} from '../../common'
import type {Account} from '.'

type DropdownTextProps = {
  text: string,
}

// A text selection, e.g., "Create a new account".
export const DropdownText = ({text, ...props}: DropdownTextProps) => (
  <Kb.Box2 {...props} direction="horizontal" centerChildren={true} fullWidth={true}>
    <Kb.Text type="BodySemibold">{text}</Kb.Text>
  </Kb.Box2>
)

type SelectedEntryProps = {
  account: Account,
}

// The display of the selected account in the dropdown.
export const SelectedEntry = ({account, ...props}: SelectedEntryProps) => (
  <Kb.Box2 {...props} direction="horizontal" centerChildren={true} gap="tiny" fullWidth={true}>
    <Kb.Avatar size={16} username={account.user} />
    <Kb.Text type="BodySemibold">{account.name}</Kb.Text>
  </Kb.Box2>
)

type DropdownEntryProps = {
  account: Account,
}

// The display of an entry in the dropdown popup.
export const DropdownEntry = (props: DropdownEntryProps) => (
  <AccountEntry
    keybaseUser={props.account.user}
    name={props.account.name}
    contents={props.account.contents}
    showWalletIcon={false}
    center={true}
  />
)
