// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {ParticipantsRow} from '../../common'
import {isLargeScreen} from '../../../constants/platform'
import {SelectedEntry, DropdownEntry, DropdownText} from './dropdown'
import Search from './search'
import type {Account} from '.'
import {debounce} from 'lodash-es'

type ToKeybaseUserProps = {|
  isRequest: boolean,
  recipientUsername: string,
  errorMessage?: string,
  onShowProfile: string => void,
  onShowSuggestions: () => void,
  onRemoveProfile: () => void,
  onChangeRecipient: string => void,
  onScanQRCode: ?() => void,
|}

const placeholderExample = isLargeScreen ? 'Ex: G12345... or you*example.com' : 'G12.. or you*example.com'

const ToKeybaseUser = (props: ToKeybaseUserProps) => {
  if (props.recipientUsername) {
    // A username has been set, so display their name and avatar.
    return (
      <ParticipantsRow
        heading={props.isRequest ? 'From' : 'To'}
        headingAlignment="Left"
        dividerColor={props.errorMessage ? Styles.globalColors.red : ''}
        style={styles.toKeybaseUser}
      >
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inputBox}>
          <Kb.Box2 direction="horizontal" centerChildren={true} fullWidth={true}>
            <Kb.ConnectedNameWithIcon
              colorBroken={true}
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
          {!!props.errorMessage && (
            <Kb.Text type="BodySmall" style={styles.errorText}>
              {props.errorMessage}
            </Kb.Text>
          )}
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
  setReadyToSend: boolean => void,
  keyCounter: number,
|}

type ToStellarPublicKeyState = {|
  recipientPublicKey: string,
|}

class ToStellarPublicKey extends React.Component<ToStellarPublicKeyProps, ToStellarPublicKeyState> {
  state = {recipientPublicKey: this.props.recipientPublicKey}
  _input: {current: React$ElementRef<typeof Kb.PlainInput> | null} = React.createRef()
  _propsOnChangeRecipient = debounce(this.props.onChangeRecipient, 1e3)
  _onChangeRecipient = recipientPublicKey => {
    this.setState({recipientPublicKey})
    this.props.setReadyToSend(false)
    this._propsOnChangeRecipient(recipientPublicKey)
  }

  _onFocus = () => {
    this._input.current && this._input.current.focus()
  }

  render = () => (
    <ParticipantsRow
      heading="To"
      headingAlignment="Left"
      headingStyle={styles.heading}
      dividerColor={this.props.errorMessage ? Styles.globalColors.red : ''}
      style={styles.toStellarPublicKey}
    >
      <Kb.Box2 direction="vertical" fullWidth={!Styles.isMobile} style={styles.inputBox}>
        <Kb.Box2 direction="horizontal" gap="xxtiny" fullWidth={!Styles.isMobile} style={styles.inputInner}>
          <Kb.Icon
            type={
              this.state.recipientPublicKey.length === 0 || this.props.errorMessage
                ? 'icon-stellar-logo-grey-16'
                : 'icon-stellar-logo-16'
            }
          />
          <Kb.Box2 direction="horizontal" style={styles.publicKeyInputContainer}>
            <Kb.NewInput
              type="text"
              onChangeText={this._onChangeRecipient}
              textType="BodySemibold"
              hideBorder={true}
              containerStyle={styles.input}
              multiline={true}
              // $FlowIssue this is the right type
              ref={this._input}
              rowsMin={2}
              rowsMax={3}
              value={this.state.recipientPublicKey}
            />
            {!this.state.recipientPublicKey && (
              <Kb.ClickableBox
                activeOpacity={1}
                onClick={this._onFocus}
                style={Styles.collapseStyles([Styles.globalStyles.fillAbsolute, styles.placeholderContainer])}
              >
                <Kb.Text type="BodySemibold" style={styles.colorBlack20}>
                  Stellar address
                </Kb.Text>
                <Kb.Text type="BodySemibold" style={styles.colorBlack20} lineClamp={1} ellipsizeMode="middle">
                  {placeholderExample}
                </Kb.Text>
              </Kb.ClickableBox>
            )}
          </Kb.Box2>
          {!this.state.recipientPublicKey &&
            this.props.onScanQRCode && (
              <Kb.Icon
                color={Styles.globalColors.black_40}
                type="iconfont-qr-code"
                fontSize={24}
                onClick={this.props.onScanQRCode}
                style={Kb.iconCastPlatformStyles(styles.qrCode)}
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
    alignItems: 'flex-start',
    minHeight: 52,
  },
  heading: {
    alignSelf: 'flex-start',
  },
  inputBox: Styles.platformStyles({isElectron: {flexGrow: 1}, isMobile: {flex: 1}}),
  inputInner: Styles.platformStyles({
    common: {
      alignItems: 'flex-start',
      flex: 1,
      position: 'relative',
    },
    isElectron: {
      flexShrink: 0,
    },
  }),
  input: Styles.platformStyles({
    common: {
      padding: 0,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.xtiny,
    },
  }),
  placeholderContainer: Styles.platformStyles({
    common: {
      display: 'flex',
      flexDirection: 'column',
      paddingLeft: (Styles.isMobile ? 0 : 16) + 4,
    },
    isElectron: {
      cursor: 'text',
    },
  }),
  publicKeyInputContainer: {flexShrink: 1, flexGrow: 1},
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

  colorBlack20: {
    color: Styles.globalColors.black_20,
  },
  qrCode: {
    marginRight: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.tiny,
  },
})

export type {ToKeybaseUserProps, ToStellarPublicKeyProps}

export {ToKeybaseUser, ToStellarPublicKey, ToOtherAccount}
