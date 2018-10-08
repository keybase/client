// @flow
import * as React from 'react'
import {Text} from '../../../common-adapters'
import {Wrapper, ContinueButton} from '../common'

type Props = {|
  error: string,
  onBack: () => void,
  onRestart: () => void,
|}

const Error = (props: Props) => (
  <Wrapper onBack={props.onBack}>
    <Text type="Header" style={{maxWidth: 460, textAlign: 'center', width: '80%'}}>
      Ah Shoot! Something went wrong, wanna try again?
    </Text>
    <Text type="BodySmallError">{props.error}</Text>
    <ContinueButton label="Try again" onClick={props.onRestart} />
  </Wrapper>
)

export default Error
