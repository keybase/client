// @flow
import * as React from 'react'
import {Box2, Button, Icon} from '../../../common-adapters'
import Available from '../available/container'
import {globalColors, globalMargins} from '../../../styles'

type Props = {
  onClickSend: Function,
  onClickRequest?: Function,
  disabled?: boolean,
}

const Footer = ({onClickSend, onClickRequest, disabled}: Props) => (
  <Box2 direction="vertical" fullWidth={true}>
    <Box2
      direction="horizontal"
      style={{flex: 1, alignItems: 'stretch', justifyContent: 'center'}}
      fullWidth={true}
    >
      {!!onClickRequest && (
        <Button
          type="Wallet"
          label="Request"
          onClick={onClickRequest}
          disabled={disabled}
          fullWidth={true}
          style={{marginLeft: globalMargins.tiny, marginRight: globalMargins.tiny}}
          children={
            <Icon
              type="iconfont-stellar-request"
              style={{marginRight: globalMargins.tiny}}
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
        style={{marginLeft: globalMargins.tiny, marginRight: globalMargins.tiny}}
        children={
          <Icon
            type="iconfont-stellar-send"
            style={{marginRight: globalMargins.tiny}}
            color={globalColors.white}
          />
        }
      />
    </Box2>
    <Available />
  </Box2>
)

export default Footer
