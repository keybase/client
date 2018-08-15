// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Banner from '../banner'
import type {Background} from '../../common-adapters/text'
import Header from './header'
import Participants from '../participants'
import NoteAndMemo from './note-and-memo'
import type {CounterpartyType} from '../../constants/types/wallets'

type ConfirmSendProps = {|
  onClose: () => void,
  onSendClick: () => void,
  onBack: () => void,
  amount: string,
  assetType: string,
  assetConversion?: string,
  waiting?: boolean,
  encryptedNote?: string,
  publicMemo?: string,
  bannerBackground?: Background,
  bannerText?: string,
  waitingKey?: string,
  // TODO: these props are probably one level too high, and should be in Participants' container.
  yourUsername: string,
  yourWalletName: string,
  yourWalletContents: string,
  receiverUsername: string,
  receiverFullName: string,
  recipientType: CounterpartyType,
|}

const ConfirmSend = (props: ConfirmSendProps) => (
  <Kb.MaybePopup onClose={props.onClose}>
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.container}>
      <Header
        amount={props.amount}
        assetType={props.assetType}
        assetConversion={props.assetConversion}
        onBack={props.onBack}
      />
      <Kb.ScrollView style={styles.scrollView}>
        {!!props.bannerBackground &&
          !!props.bannerText && <Banner background={props.bannerBackground} text={props.bannerText} />}
        <Participants
          recipientType={props.recipientType}
          isConfirm={true}
          recipientUsername={props.receiverUsername}
          recipientFullName={props.receiverFullName}
          fromWalletUser={props.yourUsername}
          fromWallet={props.yourWalletName}
          fromWalletContents={props.yourWalletContents}
        />
        {(!!props.encryptedNote || !!props.publicMemo) && (
          <NoteAndMemo encryptedNote={props.encryptedNote} publicMemo={props.publicMemo} />
        )}
      </Kb.ScrollView>
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        centerChildren={true}
        gap="small"
        gapStart={true}
        gapEnd={true}
        style={styles.buttonContainer}
      >
        <Kb.WaitingButton
          type="PrimaryGreen"
          onClick={props.onSendClick}
          waitingKey={props.waitingKey}
          fullWidth={true}
          style={styles.button}
          children={
            <React.Fragment>
              <Kb.Icon
                type="iconfont-stellar-send"
                style={Kb.iconCastPlatformStyles(styles.icon)}
                color={Styles.globalColors.white}
              />
              <Kb.Text type="BodySemibold" style={styles.buttonText}>
                Send{' '}
                <Kb.Text type="BodyExtrabold" style={styles.buttonText}>
                  {props.amount} {props.assetType}
                </Kb.Text>
              </Kb.Text>
            </React.Fragment>
          }
        />
      </Kb.Box2>
    </Kb.Box2>
  </Kb.MaybePopup>
)

const styles = Styles.styleSheetCreate({
  buttonText: {color: Styles.globalColors.white},
  buttonIcon: {
    marginRight: Styles.globalMargins.tiny,
  },
  buttonContainer: Styles.platformStyles({
    common: {
      flexShrink: 0,
      alignSelf: 'flex-end',
    },
    isElectron: {
      borderTopStyle: 'solid',
      borderTopWidth: 1,
      borderTopColor: Styles.globalColors.black_05,
    },
  }),
  button: {
    marginTop: Styles.globalMargins.small,
    marginBottom: Styles.globalMargins.small,
  },
  container: Styles.platformStyles({
    isElectron: {
      height: 525,
      width: 360,
    },
  }),
  scrollView: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 'auto',
  },
})

export default ConfirmSend
