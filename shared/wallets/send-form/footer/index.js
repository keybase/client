// @flow
import * as React from 'react'
import * as Constants from '../../../constants/wallets'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  calculating: boolean,
  disabled?: boolean,
  onClickRequest?: Function,
  onClickSend?: Function,
  waitingKey: string,
  worthDescription?: string,
}

const Footer = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
    <Kb.Box2
      direction="vertical"
      gap="tiny"
      gapEnd={true}
      gapStart={true}
      fullWidth={true}
      style={styles.background}
    >
      {(!!props.worthDescription || props.calculating) && (
        <Kb.Box2 direction="horizontal">
          {props.worthDescription ? (
            <Kb.Text style={styles.worthDescription} type="BodySmall">
              This is <Kb.Text type="BodySmallExtrabold">{props.worthDescription}</Kb.Text>.
            </Kb.Text>
          ) : (
            <Kb.Text style={styles.worthDescription} type="BodySmall">
              Calculating...
            </Kb.Text>
          )}
          {/* <Kb.Icon
            type="iconfont-question-mark"
            color={Styles.globalColors.black_20}
            hoverColor={Styles.globalColors.black_40}
            fontSize={12}
            style={Kb.iconCastPlatformStyles(styles.questionIcon)}
            onClick={() => {
              TODO
          }/> */}
        </Kb.Box2>
      )}
      <Kb.ButtonBar align="center" direction="row" style={styles.buttonBox} fullWidth={true}>
        {!!props.onClickRequest && (
          <Kb.WaitingButton
            type="Wallet"
            label="Request"
            waitingKey={Constants.requestPaymentWaitingKey}
            onClick={props.onClickRequest}
            disabled={props.disabled}
            fullWidth={true}
            style={styles.button}
            children={
              <Kb.Icon
                type="iconfont-stellar-request"
                style={Kb.iconCastPlatformStyles(styles.icon)}
                color={Styles.globalColors.white}
              />
            }
          />
        )}
        {!!props.onClickSend && (
          <Kb.WaitingButton
            type="Wallet"
            waitingKey={props.waitingKey}
            label="Send"
            onClick={props.onClickSend}
            disabled={props.disabled}
            fullWidth={true}
            style={styles.button}
            children={
              <Kb.Icon
                type="iconfont-stellar-send"
                style={Kb.iconCastPlatformStyles(styles.icon)}
                color={Styles.globalColors.white}
              />
            }
          />
        )}
      </Kb.ButtonBar>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  background: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blue5,
    },
    isElectron: {
      borderBottomLeftRadius: 4,
      borderBottomRightRadius: 4,
    },
  }),
  button: {
    flex: 1,
  },
  buttonBox: Styles.platformStyles({
    common: {
      justifyContent: 'center',
      minHeight: 0,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
    isElectron: {},
  }),
  container: Styles.platformStyles({
    common: {
      flexShrink: 0,
      justifyContent: 'flex-end',
    },
  }),
  icon: {marginRight: Styles.globalMargins.tiny},
  questionIcon: {
    marginLeft: 1,
  },
  worthDescription: {
    textAlign: 'center',
  },
})

export default Footer
