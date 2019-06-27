import * as React from 'react'
import * as Constants from '../../../constants/wallets'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  calculating: boolean
  disabled?: boolean
  onClickRequest?: () => void
  onClickSend?: () => void
  thisDeviceIsLockedOut: boolean
  waitingKey: string
  worthDescription?: string
}

const Footer = (props: Props) => {
  const sendButton = (
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
  )
  return (
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
              <Kb.Text center={true} type="BodySmall">
                This is <Kb.Text type="BodySmallExtrabold">{props.worthDescription}</Kb.Text>.
              </Kb.Text>
            ) : (
              <Kb.Text center={true} type="BodySmall">
                Calculating...
              </Kb.Text>
            )}
            {/* <Kb.Icon
            type="iconfont-question-mark"
            color={Styles.globalColors.black_20}
            hoverColor={Styles.globalColors.black_50}
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
          {!!props.onClickSend &&
            (props.thisDeviceIsLockedOut ? (
              <Kb.WithTooltip text="This is a mobile-only wallet." containerStyle={styles.fullWidth}>
                {sendButton}
              </Kb.WithTooltip>
            ) : (
              sendButton
            ))}
        </Kb.ButtonBar>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  background: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.blueLighter3,
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
  fullWidth: {
    width: '100%',
  },
  icon: {marginRight: Styles.globalMargins.tiny},
  questionIcon: {
    marginLeft: 1,
  },
})

export default Footer
