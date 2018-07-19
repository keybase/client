// @flow
import * as React from 'react'
import {Box2, Button, Icon, iconCastPlatformStyles} from '../../../common-adapters'
import Available from '../available/container'
import {globalColors, globalMargins, styleSheetCreate} from '../../../styles'

type Props = {
  onClickSend: Function,
  onClickRequest?: Function,
  disabled?: boolean,
}

const Footer = ({onClickSend, onClickRequest, disabled}: Props) => (
  <Box2 direction="vertical" fullWidth={true}>
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
      <Button
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
      />
    </Box2>
    <Available />
  </Box2>
)

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
})

export default Footer
