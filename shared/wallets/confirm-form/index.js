// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Banner from '../banner'
import Header from './header'
import Participants from './participants/container'
import NoteAndMemo from './note-and-memo'
import {type Banner as BannerType} from '../../constants/types/wallets'

type ConfirmSendProps = {|
  onClose: () => void,
  onExitFailed: () => void,
  onSendClick: () => void,
  onBack: () => void,
  onReviewProofs: () => void,
  encryptedNote?: string,
  publicMemo?: string,
  banners?: Array<BannerType>,
  sendFailed: boolean,
  waitingKey: string,
  sendingIntentionXLM: boolean,
  displayAmountXLM: string,
  displayAmountFiat: string,
  readyToSend: string,
|}

const getBannerAction = (props: ConfirmSendProps, banner: BannerType) => {
  if (banner.reviewProofs) {
    return props.onReviewProofs
  }
  if (banner.sendFailed) {
    return props.onExitFailed
  }
  return null
}

const ConfirmSend = (props: ConfirmSendProps) => (
  <Kb.MaybePopup onClose={props.sendFailed ? props.onExitFailed : props.onClose}>
    {Styles.isMobile && <Kb.SafeAreaViewTop style={styles.safeAreaViewTop} />}
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} style={styles.container}>
      <Header
        onBack={props.sendFailed ? props.onExitFailed : props.onBack}
        sendingIntentionXLM={props.sendingIntentionXLM}
        displayAmountXLM={props.displayAmountXLM}
        displayAmountFiat={props.displayAmountFiat}
      />
      {(props.banners || []).map(banner => (
        <Banner
          background={banner.bannerBackground}
          key={banner.bannerText}
          onAction={getBannerAction(props, banner)}
          reviewProofs={banner.reviewProofs}
          sendFailed={banner.sendFailed}
          text={banner.bannerText}
        />
      ))}
      <Kb.ScrollView style={styles.scrollView}>
        <Participants />
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
        {props.readyToSend === 'spinning' ? (
          <Kb.Button type="PrimaryGreen" fullWidth={true} style={styles.button} waiting={true} />
        ) : (
          <Kb.WaitingButton
            type="PrimaryGreen"
            disabled={props.sendFailed || props.readyToSend === 'disabled'}
            onClick={props.onSendClick}
            waitingKey={props.waitingKey}
            fullWidth={true}
            style={styles.button}
            children={
              <React.Fragment>
                <Kb.Icon
                  type="iconfont-stellar-send"
                  style={Kb.iconCastPlatformStyles(styles.buttonIcon)}
                  color={Styles.globalColors.white}
                />
                <Kb.Text type="BodyBig" style={styles.buttonText}>
                  Send{' '}
                  <Kb.Text type="BodyBigExtrabold" style={styles.buttonText}>
                    {props.displayAmountXLM}
                  </Kb.Text>
                </Kb.Text>
              </React.Fragment>
            }
          />
        )}
      </Kb.Box2>
    </Kb.Box2>
  </Kb.MaybePopup>
)

const styles = Styles.styleSheetCreate({
  button: {
    marginBottom: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.small,
  },
  buttonContainer: Styles.platformStyles({
    common: {
      alignSelf: 'flex-end',
      flexShrink: 0,
    },
    isElectron: {
      borderTopColor: Styles.globalColors.black_10,
      borderTopStyle: 'solid',
      borderTopWidth: 1,
    },
  }),
  buttonIcon: {
    marginRight: Styles.globalMargins.xtiny,
  },
  buttonText: {color: Styles.globalColors.white},
  container: Styles.platformStyles({
    isElectron: {
      height: 525,
      width: 360,
    },
    isMobile: {
      flexGrow: 1,
      flexShrink: 1,
      maxHeight: '100%',
      width: '100%',
    },
  }),
  safeAreaViewTop: {backgroundColor: Styles.globalColors.purple, flexGrow: 0},
  scrollView: {
    flexBasis: 'auto',
    flexGrow: 0,
    flexShrink: 1,
  },
})

export default ConfirmSend
