// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {ParticipantsRow} from '../../common'
import {SelectedEntry, DropdownEntry, DropdownText} from './dropdown'
import Search from './search'
import type {Account} from '.'
import {debounce} from 'lodash-es'

type ToKeybaseUserProps = {|
  recipientUsername: string,
  onShowProfile: string => void,
  onShowSuggestions: () => void,
  onRemoveProfile: () => void,
  onChangeRecipient: string => void,
  onScanQRCode: ?() => void,
|}

const ToKeybaseUser = (props: ToKeybaseUserProps) => {
  if (props.recipientUsername) {
    // A username has been set, so display their name and avatar.
    return (
      <ParticipantsRow heading="To" headingAlignment="Left" style={styles.toKeybaseUser}>
        <Kb.Box2 direction="horizontal" centerChildren={true} fullWidth={true}>
          <Kb.ConnectedNameWithIcon
            colorFollowing={true}
            horizontal={true}
            containerStyle={styles.toKeybaseUserNameWithIcon}
            username={props.recipientUsername}
            avatarStyle={styles.avatar}
            avatarSize={32}
            onClick="tracker"
          />
          <Kb.Icon
            type="iconfont-remove"
            boxStyle={Kb.iconCastPlatformStyles(styles.keybaseUserRemoveButton)}
            fontSize={16}
            color={Styles.globalColors.black_20}
            onClick={props.onRemoveProfile}
          />
        </Kb.Box2>
      </ParticipantsRow>
    )
  }

  // No username, so show search box.
  return (
    <Search
      onClickResult={props.onChangeRecipient}
      onClose={() => {}}
      onShowSuggestions={props.onShowSuggestions}
      onShowTracker={props.onShowProfile}
      onScanQRCode={props.onScanQRCode}
    />
  )
}

type ToStellarPublicKeyProps = {|
  recipientPublicKey: string,
  errorMessage?: string,
  onChangeRecipient: string => void,
  onScanQRCode: ?() => void,
|}

class ToStellarPublicKey extends React.Component<ToStellarPublicKeyProps> {
  _onChangeRecipient = debounce(this.props.onChangeRecipient, 1e3)

  render = () => (
    <ParticipantsRow
      heading="To"
      headingAlignment="Left"
      headingStyle={styles.heading}
      dividerColor={this.props.errorMessage ? Styles.globalColors.red : ''}
      style={styles.toStellarPublicKey}
    >
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inputBox}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inputInner}>
          <Kb.Icon
            type={
              this.props.recipientPublicKey.length === 0 || this.props.errorMessage
                ? 'icon-stellar-logo-grey-16'
                : 'icon-stellar-logo-16'
            }
            style={Kb.iconCastPlatformStyles(styles.stellarIcon)}
          />
          <Kb.Box2 direction="horizontal" style={{flexShrink: 1, flexGrow: 1}}>
            <Kb.NewInput
              type="text"
              onChangeText={this._onChangeRecipient}
              textType="BodySemibold"
              placeholder={'Stellar address\nEx: G12345... or you*example.com'}
              placeholderColor={Styles.globalColors.black_20}
              hideBorder={true}
              containerStyle={styles.input}
              multiline={true}
              rowsMin={2}
              rowsMax={3}
              value={this.props.recipientPublicKey}
            />
          </Kb.Box2>
          {!this.props.recipientPublicKey &&
            this.props.onScanQRCode && (
              <Kb.Icon
                color={Styles.globalColors.black_40}
                type="iconfont-qr-code"
                fontSize={24}
                onClick={this.props.onScanQRCode}
                style={styles.qrCode}
              />
            )}
        </Kb.Box2>
        {!!this.props.errorMessage && (
          <Kb.Text type="BodySmall" style={styles.errorText}>
            {this.props.errorMessage}
          </Kb.Text>
        )}
      </Kb.Box2>
    </ParticipantsRow>
  )
}

type ToOtherAccountProps = {|
  user: string,
  toAccount?: Account,
  allAccounts: Account[],
  onChangeRecipient: string => void,
  onLinkAccount: () => void,
  onCreateNewAccount: () => void,
  showSpinner: boolean,
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

  render = () => {
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
      <DropdownText
        spinner={this.props.showSpinner}
        key="link-existing"
        text="Link an existing Stellar account"
      />,
      <DropdownText spinner={this.props.showSpinner} key="create-new" text="Create a new account" />,
    ]

    if (this.props.allAccounts.length > 0) {
      const walletItems = this.props.allAccounts.map(account => (
        <DropdownEntry key={account.id} account={account} user={this.props.user} />
      ))
      items = walletItems.concat(items)
    }

    return (
      <ParticipantsRow heading="To" headingAlignment="Right" style={styles.toAccountRow}>
        <Kb.Dropdown
          onChanged={this.onAccountDropdownChange}
          items={items}
          style={styles.dropdown}
          selectedBoxStyle={styles.dropdownSelectedBox}
          selected={
            this.props.toAccount ? (
              <SelectedEntry
                spinner={this.props.showSpinner}
                account={this.props.toAccount}
                user={this.props.user}
              />
            ) : (
              <DropdownText
                spinner={this.props.showSpinner}
                key="placeholder-select"
                text="Pick another account"
              />
            )
          }
        />
      </ParticipantsRow>
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
  toKeybaseUser: {
    height: 48,
  },
  toKeybaseUserNameWithIcon: {
    flexGrow: 1,
  },

  // ToStellarPublicKey
  toStellarPublicKey: {
    height: 52,
  },
  heading: {
    alignSelf: 'flex-start',
  },
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
  dropdownSelectedBox: Styles.platformStyles({
    isMobile: {minHeight: 32},
  }),
  dropdown: Styles.platformStyles({
    isMobile: {height: 32},
  }),
  toAccountRow: Styles.platformStyles({
    isMobile: {
      height: 40,
      paddingBottom: 4,
      paddingTop: 4,
    },
  }),

  qrCode: {
    marginRight: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.tiny,
  },
})

export type {ToKeybaseUserProps, ToStellarPublicKeyProps}

export {ToKeybaseUser, ToStellarPublicKey, ToOtherAccount}
