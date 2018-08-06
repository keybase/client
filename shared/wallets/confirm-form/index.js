// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Banner from '../banner/container'
import Participants from './participants'
import NoteAndMemo from './note-and-memo'

type ConfirmSendProps = {|
  onClose: () => void,
  onBack: () => void,
  onSendClick: () => void,
  amount: string,
  assetType: string,
  assetConversion?: string,
  waiting?: boolean,
  encryptedNote?: string,
  publicMemo?: string,
  bannerBackground?: string,
  bannerText?: string,
|}

const ConfirmSend = (props: ConfirmSendProps) => (
  <Kb.MaybePopup onClose={props.onClose}>
    <Kb.Box2 direction="vertical" style={styles.container}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.header}>
        <Kb.BackButton
          onClick={props.onBack}
          style={styles.backButton}
          iconColor={Styles.globalColors.white}
          textStyle={styles.backButtonText}
        />
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          // fullHeight={true}
          centerChildren={true}
          style={styles.headerContent}
        >
          <Kb.Icon
            type={
              Styles.isMobile ? 'icon-fancy-stellar-sending-desktop' : 'icon-fancy-stellar-sending-mobile'
            }
            style={Kb.iconCastPlatformStyles(styles.headerIcon)}
          />
          <Kb.Text type="BodySmall" style={styles.headerText}>
            Sending{!!props.assetConversion && ` ${props.assetType} worth`}
          </Kb.Text>
          <Kb.Text type="HeaderBigExtrabold" style={styles.headerText}>
            {props.assetConversion ? props.assetConversion : props.amount}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
      <Kb.ScrollView>
        {!!props.bannerBackground &&
          !!props.bannerText && <Banner background={props.bannerBackground} text={props.bannerText} />}
        <Participants receivingUsername="nathunsmitty" receivingFullName="Nathan Smith" />
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
        <Kb.Button
          type="PrimaryGreen"
          onClick={props.onSendClick}
          waiting={props.waiting}
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
                  {props.amount}
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
  backButton: {
    position: 'absolute',
    top: Styles.globalMargins.small,
    left: Styles.globalMargins.small,
  },
  backButtonText: {
    color: Styles.globalColors.white,
  },
  buttonText: {color: Styles.globalColors.white},
  buttonIcon: {
    marginRight: Styles.globalMargins.tiny,
  },
  container: Styles.platformStyles({
    isElectron: {
      height: 525,
      width: 360,
    },
  }),
  header: Styles.platformStyles({
    isElectron: {
      minHeight: 144,
      flex: 1,
      backgroundColor: Styles.globalColors.purple,
    },
  }),
  headerContent: {
    position: 'relative',
    height: 'calc(100% + 20px)',
    top: -20,
  },
  headerText: Styles.platformStyles({
    isElectron: {
      color: Styles.globalColors.white,
      textTransform: 'uppercase',
    },
  }),
  headerIcon: {
    width: 100,
    marginBottom: Styles.globalMargins.small,
  },
  buttonContainer: Styles.platformStyles({
    isElectron: {
      borderTopStyle: 'solid',
      borderTopWidth: 1,
      borderTopColor: Styles.globalColors.black_05,
      flexShrink: 0,
      alignSelf: 'flex-end',
    },
  }),
  button: {
    marginTop: Styles.globalMargins.small,
    marginBottom: Styles.globalMargins.small,
  },
})

export default ConfirmSend
