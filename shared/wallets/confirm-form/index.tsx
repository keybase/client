import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Banner from '../banner'
import Header from './header'
import NoteAndMemo from './note-and-memo'
import {Banner as BannerType} from '../../constants/types/wallets'

type ConfirmSendProps = {
  onClose: () => void
  onSendClick: () => void
  onBack: () => void
  encryptedNote?: string
  participantsComp: React.ComponentType<{}>
  publicMemo?: string
  banners?: Array<BannerType>
  sendFailed: boolean
  waitingKey: string
  sendingIntentionXLM: boolean
  displayAmountXLM: string
  displayAmountFiat: string
  readyToSend: string
  showCancelInsteadOfBackOnMobile: boolean
}

const ConfirmSend = (props: ConfirmSendProps) => {
  const Participants = props.participantsComp
  return (
    <Kb.MaybePopup onClose={props.onClose}>
      <Kb.Box2 direction="vertical" fullHeight={!Styles.isMobile} fullWidth={true} style={styles.container}>
        <Header
          onBack={props.onBack}
          sendingIntentionXLM={props.sendingIntentionXLM}
          displayAmountXLM={props.displayAmountXLM}
          displayAmountFiat={props.displayAmountFiat}
          showCancelInsteadOfBackOnMobile={props.showCancelInsteadOfBackOnMobile}
        />
        {(props.banners || []).map(banner => (
          <Banner
            background={banner.bannerBackground}
            key={banner.bannerText}
            onAction={banner.action}
            reviewProofs={banner.reviewProofs}
            sendFailed={banner.sendFailed}
            text={banner.bannerText}
          />
        ))}
        <Kb.ScrollView style={styles.scrollView} alwaysBounceVertical={false}>
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
          style={styles.buttonContainer}
        >
          {props.readyToSend === 'spinning' ? (
            <Kb.Button type="Success" fullWidth={true} style={styles.button} waiting={true} />
          ) : (
            <Kb.WaitingButton
              type="Success"
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
}
const styles = Styles.styleSheetCreate({
  backgroundColorPurple: {backgroundColor: Styles.globalColors.purpleDark},
  button: {
    marginBottom: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.small,
  },
  buttonContainer: Styles.platformStyles({
    common: {
      ...Styles.padding(0, Styles.globalMargins.small),
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
      height: 560,
      width: 400,
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
