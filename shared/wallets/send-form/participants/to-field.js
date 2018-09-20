// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {ParticipantsRow} from '../../common'
import {SelectedEntry, DropdownEntry, DropdownText} from './dropdown'
import Search from './search'
import type {Account} from '.'
import type {CounterpartyType} from '../../../constants/types/wallets'

type ToFieldProps = {|
  recipientType: CounterpartyType,
  onChangeRecipient: string => void,
  // Used to display a keybase profile. We need the recipients' name and callbacks to show the tracker and remove profiles.
  recipientUsername?: string,
  recipientFullName?: string,
  onShowProfile?: string => void,
  onShowSuggestions: () => void,
  onRemoveProfile?: () => void,
  // Used for sending to a stellar address.
  incorrect?: string,
  toFieldInput: string,
  // Used for sending from account to account
  // We need the users' name, list of accounts, currently selected account, and callbacks to link and create new accounts.
  user: string,
  accounts: Account[],
  toAccount?: Account,
  onLinkAccount?: () => void,
  onCreateNewAccount?: () => void,
|}

class ToField extends React.Component<ToFieldProps> {
  onSelectRecipient = (recipient: Account | string) => {
    if (typeof recipient === 'string') {
      this.props.onChangeRecipient(recipient)
    } else {
      this.props.onChangeRecipient(recipient.id)
    }
  }

  onRemoveRecipient = () => {
    this.props.onChangeRecipient('')
  }

  onDropdownChange = (node: React.Node) => {
    if (React.isValidElement(node)) {
      // $FlowIssue React.isValidElement refinement doesn't happen, see https://github.com/facebook/flow/issues/6392
      const element = (node: React.Element<any>)
      if (element.key === 'create-new' && this.props.onCreateNewAccount) {
        this.props.onCreateNewAccount()
      } else if (element.key === 'link-existing' && this.props.onLinkAccount) {
        this.props.onLinkAccount()
      } else {
        this.onSelectRecipient(element.props.account)
      }
    }
  }

  render() {
    let component

    // There are a few different ways the participants form can look:
    // Case 1: A user has been set, so we display their name and avatar
    // We can only get this case when the recipient is a stellar address or searched user, not another account.
    if (this.props.recipientUsername && this.props.recipientType !== 'otherAccount') {
      component = (
        <React.Fragment>
          <Kb.ConnectedNameWithIcon
            colorFollowing={true}
            horizontal={true}
            username={this.props.recipientUsername}
            avatarStyle={styles.avatar}
            onClick="tracker"
          />
          <Kb.Icon
            type="iconfont-remove"
            boxStyle={Kb.iconCastPlatformStyles(styles.keybaseUserRemoveButton)}
            fontSize={16}
            color={Styles.globalColors.black_20}
            onClick={this.onRemoveRecipient}
          />
        </React.Fragment>
      )
    } else if (this.props.recipientType === 'otherAccount') {
      if (this.props.accounts.length <= 1 && this.props.onCreateNewAccount) {
        // Case #2: A user is sending to another account, but has no other accounts. Show a "create new account" button
        component = (
          <Kb.Box2 direction="horizontal" centerChildren={true} style={{width: 270}}>
            <Kb.Button
              type="Wallet"
              style={styles.createNewAccountButton}
              label="Create a new account"
              onClick={this.props.onCreateNewAccount}
            />
          </Kb.Box2>
        )
      } else {
        // Case #3: A user is sending from an account to another account with other accounts. Show a dropdown list of other accounts, in addition to the link existing and create new actions.
        let items = [
          <DropdownText key="link-existing" text="Link an existing Stellar account" />,
          <DropdownText key="create-new" text="Create a new account" />,
        ]

        if (this.props.accounts.length > 0) {
          const walletItems = this.props.accounts.map(account => (
            <DropdownEntry key={account.id} account={account} user={this.props.user} />
          ))
          items = walletItems.concat(items)
        }

        component = (
          <Kb.Dropdown
            onChanged={this.onDropdownChange}
            items={items}
            selected={
              this.props.toAccount ? (
                <SelectedEntry account={this.props.toAccount} user={this.props.user} />
              ) : (
                <DropdownText key="placeholder-select" text="Pick another account" />
              )
            }
          />
        )
      }
    } else if (this.props.recipientType === 'stellarPublicKey') {
      // Case #4: A user is sending to a stellar address that is either not associated to a keybase user or not complete. Show input for a stellar address.
      component = (
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inputBox}>
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inputInner}>
            <Kb.Icon
              type={
                this.props.incorrect || this.props.toFieldInput.length === 0
                  ? 'icon-stellar-logo-grey-16'
                  : 'icon-stellar-logo-16'
              }
              style={Kb.iconCastPlatformStyles(styles.stellarIcon)}
            />
            <Kb.NewInput
              type="text"
              onChangeText={this.props.onChangeRecipient}
              textType="BodySemibold"
              placeholder={'Stellar address'}
              placeholderColor={Styles.globalColors.black_20}
              hideBorder={true}
              containerStyle={styles.input}
              multiline={true}
              rowsMin={2}
              rowsMax={3}
            />
          </Kb.Box2>
          {!!this.props.incorrect && (
            <Kb.Text type="BodySmall" style={styles.errorText}>
              {this.props.incorrect}
            </Kb.Text>
          )}
        </Kb.Box2>
      )
    } else if (this.props.onShowProfile) {
      // Case #5: A user is sending to a keybase user but has not selected a keybase user yet. Show search input for keybase users.
      return (
        <Search
          onClickResult={this.onSelectRecipient}
          onClose={() => {}}
          onShowSuggestions={this.props.onShowSuggestions}
          onShowTracker={this.props.onShowProfile}
        />
      )
    }

    return (
      <ParticipantsRow
        heading="To"
        headingAlignment={this.props.recipientType === 'otherAccount' ? 'Right' : 'Left'}
        headingStyle={
          this.props.recipientType === 'stellarPublicKey' && !this.props.recipientUsername
            ? {alignSelf: 'flex-start'}
            : {}
        }
        dividerColor={
          this.props.incorrect && this.props.recipientType === 'stellarPublicKey'
            ? Styles.globalColors.red
            : ''
        }
      >
        {component}
      </ParticipantsRow>
    )
  }
}

const styles = Styles.styleSheetCreate({
  avatar: {
    marginRight: 8,
  },
  createNewAccountButton: Styles.platformStyles({
    isElectron: {
      width: 194,
    },
  }),
  errorText: Styles.platformStyles({
    common: {
      color: Styles.globalColors.red,
      width: '100%',
    },
    isElectron: {
      wordWrap: 'break-word',
    },
  }),
  input: {
    padding: 0,
  },
  inputBox: {flexGrow: 1},
  inputInner: {
    alignItems: 'flex-start',
  },
  keybaseUserRemoveButton: {
    flex: 1,
    textAlign: 'right',
  },
  stellarIcon: {
    alignSelf: 'flex-start',
    marginRight: Styles.globalMargins.xxtiny,
  },
})

export default ToField
