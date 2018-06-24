// @flow
import * as React from 'react'
import * as Constants from '../../../constants/signup'
import {Text, WaitingButton} from '../../../common-adapters'
import Wrapper from '../wrapper'

type Props = {|
  error: string,
  onBack: () => void,
|}

const UsernameAndEmail = (props: Props) => (
  <Wrapper onBack={props.onBack}>
    <Text type="Header">Ah Shoot! Something went wrong, wanna try again?</Text>
    <Text type="BodyError">{props.error}</Text>
    <WaitingButton
      waitingKey={Constants.waitingKey}
      type="Primary"
      label="Try again"
      onClick={props.onBack}
    />
  </Wrapper>
)

export default UsernameAndEmail
