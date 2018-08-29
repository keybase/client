// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {ParticipantsRow} from '../../common'
import {SelectedEntry, DropdownEntry, DropdownText} from './dropdown'
import type {Account} from '.'
import type {CounterpartyType, AccountID} from '../../../constants/types/wallets'

type ToFieldProps = {|
  recipientType: CounterpartyType,
  // Used for send to stellar address
  incorrect?: string,
  onChangeAddress?: string => void,
  // Used for sending from account to account
  user: string,
  accounts: Account[],
  onChangeSelectedAccount: (id: AccountID) => void,
  onLinkAccount?: () => void,
  onCreateNewAccount?: () => void,
  // Used to display a keybase profile
  recipientUsername?: string,
  recipientFullName?: string,
  onShowProfile?: string => void,
  onRemoveProfile?: () => void,
|}

type ToFieldState = {|
  selectedAccount: ?Account,
|}

class ToField extends React.Component<ToFieldProps, ToFieldState> {
  state = {
    selectedAccount: null,
  }

  onDropdownChange = (node: React.Node) => {
    if (React.isValidElement(node)) {
      // $FlowIssue React.isValidElement refinement doesn't happen, see https://github.com/facebook/flow/issues/6392
      const element = (node: React.Element<any>)
      if (element.key === 'create-new' && this.props.onCreateNewAccount) {
        this.props.onCreateNewAccount()
      } else if (element.key === 'link-existing' && this.props.onLinkAccount) {
        this.props.onLinkAccount()
      } else if (this.props.onChangeSelectedAccount) {
        this.setState({selectedAccount: element.props.account})
        this.props.onChangeSelectedAccount(element.props.account.id)
      }
    }
  }

  render() {
    const stellarIcon = (
      <Kb.Icon
        type={this.props.incorrect ? 'icon-stellar-logo-grey-16' : 'icon-stellar-logo-16'}
        style={Kb.iconCastPlatformStyles(styles.stellarIcon)}
      />
    )

    let component

    if (this.props.recipientType === 'keybaseUser' && this.props.recipientUsername) {
      component = (
        <React.Fragment>
          <Kb.NameWithIcon
            colorFollowing={true}
            horizontal={true}
            recipientUsername={this.props.recipientUsername}
            metaOne={this.props.recipientFullName}
            onClick={this.props.onShowProfile}
            avatarStyle={styles.avatar}
          />
          <Kb.Icon
            type="iconfont-remove"
            boxStyle={Kb.iconCastPlatformStyles(styles.keybaseUserRemoveButton)}
            fontSize={16}
            color={Styles.globalColors.black_20}
            onClick={this.props.onRemoveProfile}
          />
        </React.Fragment>
      )
    } else if (this.props.recipientType === 'otherAccount') {
      if (this.props.accounts.length <= 1 && this.props.onCreateNewAccount) {
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
              this.state.selectedAccount ? (
                <SelectedEntry account={this.state.selectedAccount} user={this.props.user} />
              ) : (
                undefined
              )
            }
          />
        )
      }
    } else {
      component = (
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inputBox}>
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inputInner}>
            {this.props.recipientType === 'stellarPublicKey' && stellarIcon}
            <Kb.NewInput
              type="text"
              onChangeText={this.props.onChangeAddress}
              textType="BodySemibold"
              placeholder={
                this.props.recipientType === 'stellarPublicKey' ? 'Stellar address' : 'Search Keybase'
              }
              placeholderColor={Styles.globalColors.black_20}
              hideBorder={true}
              containerStyle={styles.input}
              multiline={true}
              rowsMin={this.props.recipientType === 'stellarPublicKey' ? 2 : 1}
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
