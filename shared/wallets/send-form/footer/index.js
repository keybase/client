// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {globalColors, globalMargins, platformStyles, styleSheetCreate} from '../../../styles'

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
            <Kb.Text style={styles.worthDescription} type="BodySmallItalic">
              Calculating...
            </Kb.Text>
          )}
          {/* <Kb.Icon
            type="iconfont-question-mark"
            color={globalColors.black_20}
            hoverColor={globalColors.black_40}
            fontSize={12}
            style={Kb.iconCastPlatformStyles(styles.questionIcon)}
            onClick={() => {
              TODO
          }/> */}
        </Kb.Box2>
      )}
      <Kb.ButtonBar align="center" direction="row" style={styles.buttonBox} fullWidth={true}>
        {!!props.onClickRequest && (
          <Kb.Button
            type="Wallet"
            label="Request"
            onClick={props.onClickRequest}
            disabled={props.disabled}
            fullWidth={true}
            style={styles.button}
            children={
              <Kb.Icon
                type="iconfont-stellar-request"
                style={Kb.iconCastPlatformStyles(styles.icon)}
                color={globalColors.white}
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
                color={globalColors.white}
              />
            }
          />
        )}
      </Kb.ButtonBar>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = styleSheetCreate({
  button: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    flexShrink: 0,
    justifyContent: 'flex-end',
  },
  buttonBox: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 0,
    paddingBottom: globalMargins.tiny, // total bottom padding (this + box2 gapEnd) = globalMargins.small = 16
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
  },
  icon: {marginRight: globalMargins.tiny},
  background: platformStyles({
    common: {
      backgroundColor: globalColors.blue5,
    },
    isElectron: {
      borderBottomLeftRadius: '4px',
      borderBottomRightRadius: '4px',
    },
  }),
  questionIcon: {
    marginLeft: 1,
  },
  worthDescription: {
    textAlign: 'center',
  },
})

export default Footer
