// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {globalColors, globalMargins, styleSheetCreate} from '../../../styles'

type Props = {
  disabled?: boolean,
  onClickRequest?: Function,
  onClickSend: Function,
  worthDescription?: string,
}

const Footer = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.background}>
      {!!props.worthDescription && (
        <Kb.Box2 direction="horizontal">
          <Kb.Text style={styles.worthDescription} type="BodySmall">
            This is <Kb.Text type="BodySmallExtrabold">{props.worthDescription}</Kb.Text>.
          </Kb.Text>
          <Kb.Icon
            type="iconfont-question-mark"
            color={globalColors.black_20}
            hoverColor={globalColors.black_40}
            fontSize={12}
            style={Kb.iconCastPlatformStyles(styles.questionIcon)}
            onClick={() => {
              /* TODO */
            }}
          />
        </Kb.Box2>
      )}
      <Kb.Box2 direction="horizontal" style={styles.buttonBox} fullWidth={true}>
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
        <Kb.Button
          type="Wallet"
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
      </Kb.Box2>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = styleSheetCreate({
  container: {
    flexGrow: 1,
    flexShrink: 0,
    justifyContent: 'flex-end',
  },
  buttonBox: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  button: {
    marginLeft: globalMargins.small,
    marginRight: globalMargins.small,
    marginBottom: globalMargins.small,
    marginTop: globalMargins.tiny,
  },
  icon: {marginRight: globalMargins.tiny},
  background: {
    backgroundColor: globalColors.blue5,
  },
  questionIcon: {
    marginLeft: 1,
  },
  worthDescription: {
    textAlign: 'center',
  },
})

export default Footer
