// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import WalletEntry from './wallet-entry'
import Row from './row'

export type Recipient = 'keybaseUser' | 'stellarAddress' | 'otherWallet'

type FromFieldProps = {|
  username: string,
  walletName: string,
  walletContents: string,
  isConfirm: boolean,
|}

const FromField = (props: FromFieldProps) => (
  <Row heading="From:">
    {props.isConfirm && (
      <WalletEntry keybaseUser={props.username} name={props.walletName} contents={props.walletContents} />
    )}
    {/* TODO: Add wallet dropdown for wallet->wallet */}
  </Row>
)

type ToFieldProps = {|
  recipientType: Recipient,
  /* Used for the confirm screen */
  isConfirm: boolean,
  /* Used for send to stellar address */
  incorrect?: boolean,
  onChangeAddress?: string => void,
  stellarAddress?: string,
  /* Used to display a keybase profile */
  username?: string,
  fullName?: string,
  onShowProfile?: string => void,
  onRemoveProfile?: () => void,
|}

const ToField = (props: ToFieldProps) => {
  const stellarIcon = (
    <Kb.Icon
      type={props.incorrect ? 'icon-stellar-logo-grey-16' : 'icon-stellar-logo-16'}
      style={Kb.iconCastPlatformStyles(styles.stellarIcon)}
    />
  )

  let component

  if (props.username) {
    component = (
      <React.Fragment>
        <Kb.NameWithIcon
          colorFollowing={true}
          horizontal={true}
          username={props.username}
          metaOne={props.fullName}
          onClick={props.onShowProfile}
          avatarStyle={styles.avatar}
        />
        {!props.isConfirm && (
          <Kb.Icon
            type="iconfont-remove"
            boxStyle={Kb.iconCastPlatformStyles(styles.keybaseUserRemoveButton)}
            fontSize={16}
            color={Styles.globalColors.black_20}
            onClick={props.onRemoveProfile}
          />
        )}
      </React.Fragment>
    )
  } else if (props.isConfirm && props.recipientType === 'stellarAddress') {
    component = (
      <React.Fragment>
        {stellarIcon}
        <Kb.Text type="BodySemibold" style={styles.stellarAddressConfirmText}>
          {props.stellarAddress}
        </Kb.Text>
      </React.Fragment>
    )
  } else if (props.isConfirm && props.recipientType === 'otherWallet') {
    // TODO: Implement this
  } else if (!props.isConfirm && props.recipientType === 'otherWallet') {
    // TODO: Implement this
  } else {
    component = (
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inputBox}>
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inputInner}>
          {props.recipientType === 'stellarAddress' && stellarIcon}
          <Kb.NewInput
            type="text"
            onChangeText={props.onChangeAddress}
            textType="BodySemibold"
            placeholder={props.recipientType === 'stellarAddress' ? 'Stellar address' : 'Search Keybase'}
            placeholderColor={Styles.globalColors.black_20}
            hideBorder={true}
            containerStyle={styles.input}
            multiline={true}
            rowsMin={props.recipientType === 'stellarAddress' ? 2 : 1}
            rowsMax={3}
          />
        </Kb.Box2>
        {props.incorrect && (
          <Kb.Text type="BodySmall" style={styles.errorText}>
            This Stellar address is incorrect
          </Kb.Text>
        )}
      </Kb.Box2>
    )
  }

  return (
    <Row
      heading="To:"
      headingStyle={
        props.recipientType === 'stellarAddress' && !props.username ? {alignSelf: 'flex-start'} : {}
      }
      dividerColor={props.incorrect ? Styles.globalColors.red : ''}
      noBottomDivider={true}
    >
      {component}
    </Row>
  )
}

type ParticipantsProps = {|
  recipientType: Recipient,
  /* Used for the confirm screen */
  isConfirm?: boolean,
  fromWallet?: string,
  fromWalletUser?: string,
  fromWalletContents?: string,
  /* Used for send to stellar address */
  incorrect?: boolean,
  onChangeAddress?: string => void,
  /* Used to display a keybase profile */
  recipientUsername?: string,
  recipientFullName?: string,
  recipientStellarAddress?: string,
  onShowProfile?: string => void,
  onRemoveProfile?: () => void,
|}

const Participants = (props: ParticipantsProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    {(props.isConfirm || props.recipientType === 'otherWallet') &&
      props.fromWallet &&
      props.fromWalletUser &&
      props.fromWalletContents && (
        <FromField
          isConfirm={props.isConfirm || false}
          walletName={props.fromWallet}
          username={props.fromWalletUser}
          walletContents={props.fromWalletContents}
        />
      )}
    <ToField
      isConfirm={props.isConfirm || false}
      recipientType={props.recipientType}
      incorrect={props.incorrect}
      username={props.recipientUsername}
      fullName={props.recipientFullName}
      stellarAddress={props.recipientStellarAddress}
      onRemoveProfile={props.onRemoveProfile}
      onShowProfile={props.onShowProfile}
      onChangeAddress={props.onChangeAddress}
    />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  keybaseUserRemoveButton: {
    flex: 1,
    textAlign: 'right',
  },
  stellarIcon: {
    alignSelf: 'flex-start',
    marginRight: Styles.globalMargins.xxtiny,
  },
  stellarAddressConfirmText: Styles.platformStyles({
    isElectron: {
      wordBreak: 'break-all',
    },
  }),
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
})

export default Participants
