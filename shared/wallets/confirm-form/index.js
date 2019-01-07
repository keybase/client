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
  onSendClick: () => void,
  onBack: () => void,
  onReviewProofs?: () => void,
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

const ConfirmSend = (props: ConfirmSendProps) => (
  <Kb.MaybePopup onClose={props.onClose}>
    <Kb.SafeAreaViewTop style={styles.backgroundColorPurple} />
    <Kb.Box2 direction="vertical" fullHeight={!Styles.isMobile} fullWidth={true} style={styles.container}>
      <Header
        onBack={props.onBack}
        sendingIntentionXLM={props.sendingIntentionXLM}
        displayAmountXLM={props.displayAmountXLM}
        displayAmountFiat={props.displayAmountFiat}
      />
      {(props.banners || []).map(banner => (
        <Banner
          background={banner.bannerBackground}
          key={banner.bannerText}
          onReviewProofs={props.onReviewProofs}
          reviewProofs={banner.reviewProofs}
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
    <Kb.SafeAreaView />
  </Kb.MaybePopup>
)

const styles = Styles.styleSheetCreate({
  backgroundColorPurple: {backgroundColor: Styles.globalColors.purple},
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
      backgroundColor: Styles.globalColors.white,
      flexGrow: 1,
      flexShrink: 1,
      maxHeight: '100%',
      width: '100%',
    },
  }),
  scrollView: {
    flexBasis: 'auto',
    flexGrow: 0,
    flexShrink: 1,
  },
})

export default ConfirmSend
