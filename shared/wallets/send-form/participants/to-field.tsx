import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {ParticipantsRow} from '../../common'
import {isLargeScreen} from '../../../constants/platform'
import {SelectedEntry, DropdownEntry, DropdownText} from './dropdown'
import Search from './search'
import {Account} from '.'
import debounce from 'lodash/debounce'
import defer from 'lodash/defer'

export type ToKeybaseUserProps = {
  isRequest: boolean
  recipientUsername: string
  errorMessage?: string
  onShowProfile: (username: string) => void
  onRemoveProfile: () => void
  onChangeRecipient: (recipient: string) => void
  onScanQRCode: (() => void) | null
  onSearch: () => void
}

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
              boxStyle={styles.keybaseUserRemoveButton}
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
      heading={props.isRequest ? 'From' : 'To'}
      onClickResult={props.onChangeRecipient}
      onSearch={props.onSearch}
      onShowTracker={props.onShowProfile}
      onScanQRCode={props.onScanQRCode}
    />
  )
}

export type ToStellarPublicKeyProps = {
  recipientPublicKey: string
  errorMessage?: string
  onChangeRecipient: (recipient: string) => void
  onScanQRCode: (() => void) | null
  setReadyToReview: (ready: boolean) => void
}

const ToStellarPublicKey = (props: ToStellarPublicKeyProps) => {
  const [recipientPublicKey, setRecipentPublicKey] = React.useState(props.recipientPublicKey)
  const debouncedOnChangeRecip = React.useCallback(debounce(props.onChangeRecipient, 1e3), [
    props.onChangeRecipient,
  ])

  const {setReadyToReview} = props
  const onChangeRecipient = React.useCallback(
    (recipientPublicKey: string) => {
      setRecipentPublicKey(recipientPublicKey)
      setReadyToReview(false)
      debouncedOnChangeRecip(recipientPublicKey)
    },
    [setReadyToReview, debouncedOnChangeRecip]
  )

  React.useEffect(() => {
    if (props.recipientPublicKey !== recipientPublicKey) {
      // Hot fix to let any empty string textChange callbacks happen before we change the value.
      defer(() => setRecipentPublicKey(props.recipientPublicKey))
    }
    // We do not want this be called when the state changes
    // Only when the prop.recipientPublicKey changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.recipientPublicKey])

  return (
    <ParticipantsRow
      heading="To"
      headingAlignment="Left"
      headingStyle={styles.heading}
      dividerColor={props.errorMessage ? Styles.globalColors.red : ''}
      style={styles.toStellarPublicKey}
    >
      <Kb.Box2 direction="vertical" fullWidth={!Styles.isMobile} style={styles.inputBox}>
        <Kb.Box2 direction="horizontal" gap="xxtiny" fullWidth={!Styles.isMobile} style={styles.inputInner}>
          <Kb.Icon
            sizeType={Styles.isMobile ? 'Small' : 'Default'}
            type="iconfont-identity-stellar"
            color={
              recipientPublicKey.length === 0 || props.errorMessage
                ? Styles.globalColors.black_20
                : Styles.globalColors.black
            }
          />
          <Kb.Box2 direction="horizontal" style={styles.publicKeyInputContainer}>
            <Kb.NewInput
              type="text"
              onChangeText={onChangeRecipient}
              textType="BodySemibold"
              hideBorder={true}
              containerStyle={styles.input}
              multiline={true}
              rowsMin={2}
              rowsMax={3}
              value={recipientPublicKey}
            />
            {!recipientPublicKey && (
              <Kb.Box
                activeOpacity={1}
                pointerEvents="none"
                style={Styles.collapseStyles([Styles.globalStyles.fillAbsolute, styles.placeholderContainer])}
              >
                <Kb.Text type="BodySemibold" style={styles.colorBlack20}>
                  Stellar address
                </Kb.Text>
                <Kb.Text type="BodySemibold" style={styles.colorBlack20} lineClamp={1} ellipsizeMode="middle">
                  {placeholderExample}
                </Kb.Text>
              </Kb.Box>
            )}
          </Kb.Box2>
          {!recipientPublicKey && props.onScanQRCode && (
            <Kb.Icon
              color={Styles.globalColors.black_50}
              type="iconfont-qr-code"
              onClick={props.onScanQRCode}
              style={styles.qrCode}
            />
          )}
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

export type ToOtherAccountProps = {
  user: string
  toAccount?: Account
  allAccounts: Account[]
  onChangeRecipient: (recipient: string) => void
  onLinkAccount: () => void
  onCreateNewAccount: () => void
  showSpinner: boolean
}

class ToOtherAccount extends React.Component<ToOtherAccountProps> {
  onAccountDropdownChange = (node: React.ReactNode) => {
    if (React.isValidElement(node)) {
      const element: React.ReactElement = node
      if (element.key === 'create-new') {
        this.props.onCreateNewAccount()
      } else if (element.key === 'link-existing') {
        this.props.onLinkAccount()
      } else {
        this.props.onChangeRecipient(element.props.account.id)
      }
    }
  }

  render() {
    if (this.props.allAccounts.length <= 1) {
      // A user is sending to another account, but has no other
      // accounts. Show a "create new account" button.
      return (
        <ParticipantsRow heading="To" headingAlignment="Right" style={styles.toAccountRow}>
          <Kb.Button
            small={true}
            type="Wallet"
            style={styles.createNewAccountButton}
            label="Create a new account"
            onClick={this.props.onCreateNewAccount}
          />
        </ParticipantsRow>
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      avatar: {
        marginRight: 8,
      },
      colorBlack20: {
        color: Styles.globalColors.black_20,
      },
      createNewAccountButton: Styles.platformStyles({
        isElectron: {
          width: 194,
        },
      }),
      dropdown: Styles.platformStyles({
        isMobile: {height: 32},
      }),
      dropdownSelectedBox: Styles.platformStyles({
        isMobile: {minHeight: 32},
      }),
      errorText: Styles.platformStyles({
        common: {
          color: Styles.globalColors.redDark,
          width: '100%',
        },
        isElectron: {
          wordWrap: 'break-word',
        },
      }),
      heading: {
        alignSelf: 'flex-start',
      },
      input: Styles.platformStyles({
        common: {
          padding: 0,
        },
        isMobile: {
          paddingLeft: Styles.globalMargins.xtiny,
        },
      }),
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
      keybaseUserRemoveButton: {
        flex: 1,
        marginRight: Styles.globalMargins.tiny,
        textAlign: 'right', // consistent with UserInput
      },
      placeholderContainer: Styles.platformStyles({
        common: {
          display: 'flex',
          flexDirection: 'column',
          paddingLeft: (Styles.isMobile ? 0 : 16) + 4,
        },
        isElectron: {
          pointerEvents: 'none',
        },
      }),
      publicKeyInputContainer: {flexGrow: 1, flexShrink: 1},
      qrCode: {
        marginRight: Styles.globalMargins.tiny,
        marginTop: Styles.globalMargins.tiny,
      },
      toAccountRow: Styles.platformStyles({
        isMobile: {
          height: 40,
          paddingBottom: 4,
          paddingTop: 4,
        },
      }),
      toKeybaseUser: {
        height: 48,
      },
      toKeybaseUserNameWithIcon: {
        flexGrow: 1,
      },
      toStellarPublicKey: {
        alignItems: 'flex-start',
        minHeight: 52,
      },
    } as const)
)

export {ToKeybaseUser, ToStellarPublicKey, ToOtherAccount}
