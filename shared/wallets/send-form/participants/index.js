// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import WalletEntry from './wallet-entry'

type Recipient = 'keybaseUser' | 'stellarAddress' | 'anotherWallet'

type FromFieldProps = {|
  username: string,
  walletName: string,
  walletContents: string,
  isConfirm?: boolean,
|}

const FromField = (props: FromFieldProps) => (
  <React.Fragment>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.row}>
      <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
        From:
      </Kb.Text>
      {props.isConfirm && (
        <WalletEntry keybaseUser={props.username} name={props.walletName} contents={props.walletContents} />
      )}
      {/* TODO: Add wallet dropdown for wallet->wallet */}
    </Kb.Box2>
    <Kb.Divider />
  </React.Fragment>
)

const ToField = (props: any) => (
  <React.Fragment>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.row}>
      <Kb.Text
        type="BodyTinySemibold"
        style={Styles.collapseStyles([
          styles.headingText,
          props.recipientType === 'stellarAddress'
            ? {
                alignSelf: 'flex-start',
              }
            : {},
        ])}
      >
        To:
      </Kb.Text>
      {!!props.username && (
        <React.Fragment>
          <Kb.NameWithIcon
            colorFollowing={true}
            horizontal={true}
            username={props.username}
            metaOne={props.fullname}
            onClick={props.onShowProfile}
          />
          {!props.isConfirm && (
            <Kb.Icon
              type="iconfont-remove"
              boxStyle={Kb.iconCastPlatformStyles(styles.keybaseUserX)}
              fontSize={16}
              color={Styles.globalColors.black_20}
              onClick={props.onRemoveUser}
            />
          )}
        </React.Fragment>
      )}
      {!props.username && (
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inputBox}>
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.inputInner}>
            {props.recipientType === 'stellarAddress' && (
              <Kb.Icon
                type={props.incorrect ? 'icon-stellar-logo-grey-16' : 'icon-stellar-logo-16'}
                style={Kb.iconCastPlatformStyles(styles.icon)}
              />
            )}
            <Kb.NewInput
              type="text"
              onChangeText={props.onChangeAddress}
              textType="BodySemibold"
              placeholder={props.recipientType === 'stellarAddress' ? 'Stellar address' : 'Search Keybase'}
              placeholderColor={Styles.globalColors.black_20}
              hideBorder={true}
              // style={styles.input}
              containerStyle={styles.input}
              multiline={true}
              rowsMin={props.recipientType === 'stellarAddress' ? 2 : 1}
              rowsMax={3}
            />
          </Kb.Box2>
          {props.incorrect && (
            <Kb.Text type="BodySmall" style={styles.error}>
              This Stellar address is incorrect
            </Kb.Text>
          )}
        </Kb.Box2>
      )}
    </Kb.Box2>
    <Kb.Divider style={props.incorrect ? styles.redline : {}} />
  </React.Fragment>
)

type ParticipantsProps = {
  recipientType: Recipient,
  isConfirm?: boolean,
  fromWallet?: string,
  fromWalletUser?: string,
  fromWalletContents?: string,
  onChangeAddress?: string => void,
  incorrect?: boolean,
  username?: string,
  fullname?: string,
  onShowProfile?: string => void,

  displayRemove?: boolean,
  onRemoveProfile?: () => void,
}

const Participants = (props: ParticipantsProps) => (
  <Kb.Box2 direction="vertical" fullWidth={true}>
    {props.isConfirm &&
      props.fromWallet &&
      props.fromWalletUser &&
      props.fromWalletContents && (
        <FromField
          walletName={props.fromWallet}
          username={props.fromWalletUser}
          walletContents={props.fromWalletContents}
        />
      )}
    <ToField
      recipientType={props.recipientType}
      incorrect={props.incorrect}
      username={props.username}
      fullname={props.fullname}
    />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  headingText: {
    color: Styles.globalColors.blue,
    marginRight: Styles.globalMargins.tiny,
  },
  row: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
    paddingBottom: Styles.globalMargins.tiny,
    alignItems: 'center',
  },
  keybaseUserX: {
    flex: 1,
    textAlign: 'right',
  },
  error: Styles.platformStyles({
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
  // NewInput with icon hangs over the edge at 100%
  input: {
    padding: 0,
    marginLeft: Styles.globalMargins.xxtiny,
  },
  redline: {
    backgroundColor: Styles.globalColors.red,
  },
})

export default Participants
