// @flow
import * as React from 'react'
import {Box2, Button, Icon, iconCastPlatformStyles, Text} from '../../../common-adapters'
import Available from '../available/container'
import {globalColors, globalMargins, styleSheetCreate} from '../../../styles'

type Props = {
  onClickSend: Function,
  onClickRequest?: Function,
  disabled?: boolean,
  worthDescription: string,
}

const Footer = ({onClickSend, onClickRequest, disabled, onConfirmSend, readyToSend, worthDescription}: Props) => {
  console.warn('in footer', onClickSend, worthDescription)
  return (
  <Box2 direction="vertical" fullWidth={true} style={styles.background}>
    {!!worthDescription && <Text style={{textAlign: 'center'}} type="Body">{worthDescription}</Text>}
    <Box2 direction="horizontal" style={styles.buttonBox} fullWidth={true}>
      {!!onClickRequest && (
        <Button
          type="Wallet"
          label="Request"
          onClick={onClickRequest}
          disabled={disabled}
          fullWidth={true}
          style={styles.button}
          children={
            <Icon
              type="iconfont-stellar-request"
              style={iconCastPlatformStyles(styles.icon)}
              color={globalColors.white}
            />
          }
        />
      )}
      {readyToSend ? <Button type="Danger" label="REALLY SEND" onClick={onConfirmSend} fullWidth={true} /> : <Button
        type="Wallet"
        label="Send"
        onClick={onClickSend}
        disabled={disabled}
        fullWidth={true}
        style={styles.button}
        children={
          <Icon
            type="iconfont-stellar-send"
            style={iconCastPlatformStyles(styles.icon)}
            color={globalColors.white}
          />
        }
      />}
    </Box2>
    <Available />
  </Box2>
)
}

const styles = styleSheetCreate({
  buttonBox: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  button: {
    marginLeft: globalMargins.tiny,
    marginRight: globalMargins.tiny,
  },
  icon: {marginRight: globalMargins.tiny},
  background: {
    backgroundColor: globalColors.blue5,
  },
})

export default Footer
