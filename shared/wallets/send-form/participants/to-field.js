// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {SelectedEntry, DropdownEntry, DropdownText} from './dropdown'
import Search from './search'
import type {Account} from '.'

type ToKeybaseUserProps = {|
  recipientUsername: string,
  onShowProfile: string => void,
  onShowSuggestions: () => void,
  onRemoveProfile: () => void,
  onChangeRecipient: string => void,
|}

const ToKeybaseUser = (props: ToKeybaseUserProps) => {
  if (props.recipientUsername) {
    // A username has been set, so display their name and avatar.
    return (
      <React.Fragment>
        <Kb.ConnectedNameWithIcon
          colorFollowing={true}
          horizontal={true}
          username={props.recipientUsername}
          avatarStyle={styles.avatar}
          onClick="tracker"
        />
        <Kb.Icon
          type="iconfont-remove"
          boxStyle={Kb.iconCastPlatformStyles(styles.keybaseUserRemoveButton)}
          fontSize={16}
          color={Styles.globalColors.black_20}
          onClick={props.onRemoveProfile}
        />
      </React.Fragment>
    )
  }

  // No username, so show search box.
  return (
    <Search
      onClickResult={props.onChangeRecipient}
      onClose={() => {}}
      onShowSuggestions={props.onShowSuggestions}
      onShowTracker={props.onShowProfile}
    />
  )
}

type ToStellarPublicKeyProps = {|
  recipientPublicKey: string,
  errorMessage?: string,
  onChangeRecipient: string => void,
|}

const ToStellarPublicKey = (props: ToStellarPublicKeyProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inputBox}>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inputInner}>
      <Kb.Icon
        type={
          props.recipientPublicKey.length === 0 || props.errorMessage
            ? 'icon-stellar-logo-grey-16'
            : 'icon-stellar-logo-16'
        }
        style={Kb.iconCastPlatformStyles(styles.stellarIcon)}
      />
      <Kb.NewInput
        type="text"
        onChangeText={props.onChangeRecipient}
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
    {!!props.errorMessage && (
      <Kb.Text type="BodySmall" style={styles.errorText}>
        {props.errorMessage}
      </Kb.Text>
    )}
  </Kb.Box2>
)

type ToOtherAccountProps = {|
  user: string,
  toAccount?: Account,
  allAccounts: Account[],
  onChangeRecipient: string => void,
  onLinkAccount: () => void,
  onCreateNewAccount: () => void,
|}

class ToOtherAccount extends React.Component<ToOtherAccountProps> {
  onAccountDropdownChange = (node: React.Node) => {
    if (React.isValidElement(node)) {
      // $FlowIssue React.isValidElement refinement doesn't happen, see https://github.com/facebook/flow/issues/6392
      const element = (node: React.Element<any>)
      if (element.key === 'create-new') {
        this.props.onCreateNewAccount()
      } else if (element.key === 'link-existing') {
        this.props.onLinkAccount()
      } else {
        this.props.onChangeRecipient(element.props.account.id)
      }
    }
  }

  _onChangeStellarRecipient = debounce((to: string) => {
    this.props.onChangeRecipient(to)
  }, 1e3)

  render() {
    if (this.props.allAccounts.length <= 1) {
      // A user is sending to another account, but has no other
      // accounts. Show a "create new account" button.
      return (
        <Kb.Box2 direction="horizontal" centerChildren={true} style={{width: 270}}>
          <Kb.Button
            type="Wallet"
            style={styles.createNewAccountButton}
            label="Create a new account"
            onClick={this.props.onCreateNewAccount}
          />
        </Kb.Box2>
      )
    }

    // A user is sending from an account to another account with other
    // accounts. Show a dropdown list of other accounts, in addition
    // to the link existing and create new actions.
    let items = [
      <DropdownText key="link-existing" text="Link an existing Stellar account" />,
      <DropdownText key="create-new" text="Create a new account" />,
    ]

    if (this.props.allAccounts.length > 0) {
      const walletItems = this.props.allAccounts.map(account => (
        <DropdownEntry key={account.id} account={account} user={this.props.user} />
      ))
      items = walletItems.concat(items)
    }

    return (
      <Kb.Dropdown
        onChanged={this.onAccountDropdownChange}
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
}

const styles = Styles.styleSheetCreate({
  // ToKeybaseUser
  avatar: {
    marginRight: 8,
  },
  keybaseUserRemoveButton: {
    flex: 1,
    textAlign: 'right',
    marginRight: Styles.globalMargins.tiny, // consistent with UserInput
  },

  // ToStellarPublicKey
  inputBox: {flexGrow: 1},
  inputInner: {
    alignItems: 'flex-start',
  },
  stellarIcon: {
    alignSelf: 'flex-start',
    marginRight: Styles.globalMargins.xxtiny,
  },
  input: {
    padding: 0,
  },
  errorText: Styles.platformStyles({
    common: {
      color: Styles.globalColors.red,
      width: '100%',
    },
    isElectron: {
      wordWrap: 'break-word',
    },
  }),

  // ToOtherAccount
  createNewAccountButton: Styles.platformStyles({
    isElectron: {
      width: 194,
    },
  }),
})

export type {ToKeybaseUserProps, ToStellarPublicKeyProps}

export {ToKeybaseUser, ToStellarPublicKey, ToOtherAccount}
