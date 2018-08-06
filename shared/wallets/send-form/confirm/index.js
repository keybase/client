// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
// import Body from '../body/container'
// import Header from '../header'
import Banner from '../banner/container'
import Memo from '../memo/container'
// import Note from '../note/container'
import Participants from '../participants'

type ConfirmSendProps = {|
  onClose: () => void,
  onBack: () => void,
  onSendClick: () => void,
  amount: string,
  assetType: string,
  assetConversion?: string,
  waiting?: boolean,
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
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
          <Kb.Text type="BodySmall" style={styles.headerText}>
            Sending{!!props.assetConversion && ` ${props.assetType} worth`}
          </Kb.Text>
          <Kb.Text type="HeaderBigExtrabold" style={styles.headerText}>
            {props.assetConversion ? props.assetConversion : props.amount}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
      <Kb.ScrollView>
        <Banner />
        <Participants receivingUsername="nathunsmitty" receivingFullName="Nathan Smith" />
        <Memo />
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
  icon: {
    marginRight: Styles.globalMargins.tiny,
  },
  backButton: {
    position: 'absolute',
    top: Styles.globalMargins.small,
    left: Styles.globalMargins.small,
  },
  backButtonText: {
    color: Styles.globalColors.white,
  },
  buttonText: {color: Styles.globalColors.white},
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
  headerText: Styles.platformStyles({
    isElectron: {
      color: Styles.globalColors.white,
      textTransform: 'uppercase',
    },
  }),
  buttonContainer: Styles.platformStyles({
    isElectron: {
      borderTopStyle: 'solid',
      borderTopWidth: 1,
      borderTopColor: Styles.globalColors.black_05,
      height: 72.5,
      flexShrink: 0,
      alignSelf: 'flex-end',
    },
  }),
})

export default ConfirmSend
