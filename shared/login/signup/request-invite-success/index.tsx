import * as React from 'react'
import {Text} from '../../../common-adapters'
import {Wrapper} from '../common'

type Props = {
  onBack: () => void
}

const RequestInviteSuccess = (props: Props) => (
  <Wrapper onBack={props.onBack}>
    <Text type="Header">Invite request sent</Text>
    <Text type="Body">
      Thanks for requesting an invite to Keybase. When one becomes available, we will send it to you via
      email.
    </Text>
  </Wrapper>
)

export default RequestInviteSuccess
