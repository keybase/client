// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
// import Body from '../body/container'
// import Header from '../header'
import Banner from '../banner'
import Memo from '../memo/container'
// import Note from '../note/container'
import Participants from '../participants'
import type {Background} from '../../../common-adapters/text'

type ConfirmSendProps = {|
  onClose: () => void,
  onBack: () => void,
  amount: string,
  bannerText?: string,
  bannerBackground?: Background,
  // onClick: () => void,
|}

export default function ConfirmSend(props: ConfirmSendProps) {
  return (
    <Kb.MaybePopup onClose={props.onClose}>
      <Kb.Box2 direction="vertical" style={styles.container}>
        <Kb.Box2 direction="vertical" fullWidth={true} centerChildren={true} style={styles.header}>
          <Kb.Text type="BodySmall" style={styles.headerText}>
            Sending lumens worth
          </Kb.Text>
          <Kb.Text type="HeaderBigExtrabold" style={styles.headerText}>
            $1
          </Kb.Text>
        </Kb.Box2>
        <Kb.ScrollView>
          {!!props.bannerText &&
            !!props.bannerBackground && (
              <Banner background={props.bannerBackground} text={props.bannerText} />
            )}
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
            onClick={() => {}}
            disabled={false}
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
}

const styles = Styles.styleSheetCreate({
  icon: {
    marginRight: Styles.globalMargins.tiny,
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
