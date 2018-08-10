// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import WalletEntry from './wallet-entry'

type FromFieldProps = {|
  username: string,
  walletName: string,
  walletContents: string,
|}

const FromField = (props: FromFieldProps) => (
  <React.Fragment>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.row}>
      <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
        From:
      </Kb.Text>
      <WalletEntry keybaseUser={props.username} name={props.walletName} contents={props.walletContents} />
    </Kb.Box2>
    <Kb.Divider />
  </React.Fragment>
)

type ParticipantsProps = {
  recipientType?: 'keybaseUser' | 'stellarAddress' | 'anotherWallet',
  isConfirm?: boolean,
  fromWallet?: string,
  fromWalletUser?: string,
  fromWalletContents?: string,
  onChangeAddress?: string => void,
  incorrect?: boolean,
  username?: string,
  fullname?: string,
  onShowProfile?: string => void,

  displayX?: boolean,
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
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.row}>
      <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
        To:
      </Kb.Text>
      {!!props.username && (
        <Kb.NameWithIcon
          colorFollowing={true}
          horizontal={true}
          username={props.username}
          metaOne={props.fullname}
          onClick={props.onShowProfile}
        />
      )}
      {!props.username && (
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inputBox}>
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            <Kb.Icon
              type={props.incorrect ? 'iconfont-stellar-request' : 'iconfont-stellar-request'}
              style={Kb.iconCastPlatformStyles(styles.icon)}
            />
            <Kb.NewInput
              type="text"
              onChangeText={props.onChangeAddress}
              textType="BodySemibold"
              placeholder="Stellar address"
              placeholderColor={Styles.globalColors.grey}
              hideBorder={true}
              style={styles.input}
              multiline={true}
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
    {props.incorrect && <Kb.Box style={styles.redline} />}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  headingText: {
    color: Styles.globalColors.blue,
    marginRight: Styles.globalMargins.tiny,
    // marginTop: Styles.globalMargins.xtiny,
    // alignSelf: 'flex-start',
  },
  row: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
    paddingBottom: Styles.globalMargins.tiny,
    alignItems: 'center',
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
  inputBox: {flexGrow: 1},
  // NewInput with icon hangs over the edge at 100%
  input: {width: '90%'},
  redline: {
    backgroundColor: Styles.globalColors.red,
    height: 1,
    width: '100%',
  },
})

export default Participants
