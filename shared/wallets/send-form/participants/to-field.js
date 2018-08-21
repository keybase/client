// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import Row from '../../participants-row'
import {SelectedEntry, DropdownEntry, DropdownText} from './dropdown'
import type {Account} from '.'
import type {CounterpartyType} from '../../../constants/types/wallets'

type ToFieldProps = {|
  recipientType: CounterpartyType,
  /* Used for send to stellar address */
  incorrect?: string,
  onChangeAddress?: string => void,
  stellarAddress?: string,
  /** Used for sending from account to account */
  accounts: Account[],
  onLinkAccount?: () => void,
  onCreateNewAccount?: () => void,
  /* Used to display a keybase profile */
  username?: string,
  fullName?: string,
  onShowProfile?: string => void,
  onRemoveProfile?: () => void,
|}

type ToFieldState = {|
  selectedAccount?: Account,
|}

class ToField extends React.Component<ToFieldProps, ToFieldState> {
  state = {
    selectedAccount: undefined,
  }

  onDropdownChange = (node: React.Node) => {
    if (React.isValidElement(node)) {
      // $FlowIssue React.isValidElement refinement doesn't happen, see https://github.com/facebook/flow/issues/6392
      const element = (node: React.Element<any>)
      if (element.type === DropdownText) {
        if (element.key === 'create-new' && this.props.onCreateNewAccount) {
          this.props.onCreateNewAccount()
        } else if (element.key === 'link-existing' && this.props.onLinkAccount) {
          this.props.onLinkAccount()
        }
      } else {
        this.setState({
          selectedAccount: element.props.account,
        })
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

    if (this.props.recipientType === 'keybaseUser' && this.props.username) {
      component = (
        <React.Fragment>
          <Kb.NameWithIcon
            colorFollowing={true}
            horizontal={true}
            username={this.props.username}
            metaOne={this.props.fullName}
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
          const walletItems = this.props.accounts.map((account, index) => (
            <DropdownEntry key={index} account={account} />
          ))
          items = walletItems.concat(items)
        }

        component = (
          <Kb.Dropdown
            onChanged={this.onDropdownChange}
            items={items}
            selected={
              this.state.selectedAccount ? <SelectedEntry account={this.state.selectedAccount} /> : undefined
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
      <Row
        heading="To:"
        headingAlignment={this.props.recipientType === 'otherAccount' ? 'Right' : 'Left'}
        headingStyle={
          this.props.recipientType === 'stellarPublicKey' && !this.props.username
            ? {alignSelf: 'flex-start'}
            : {}
        }
        dividerColor={this.props.incorrect ? Styles.globalColors.red : ''}
        bottomDivider={false}
      >
        {component}
      </Row>
    )
  }
}

const styles = Styles.styleSheetCreate({
  keybaseUserRemoveButton: {
    flex: 1,
    textAlign: 'right',
  },
  stellarIcon: {
    alignSelf: 'flex-start',
    marginRight: Styles.globalMargins.xxtiny,
  },
  avatar: {
    marginRight: 8,
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
  inputInner: {
    alignItems: 'flex-start',
  },
  inputBox: {flexGrow: 1},
  input: {
    padding: 0,
  },
  createNewAccountButton: Styles.platformStyles({
    isElectron: {
      width: 194,
    },
  }),
})

export default ToField
