import * as React from 'react'
import * as Kb from '../../../common-adapters'
import {Wrapper, ContinueButton} from '../common'

type Props = {
  header: string
  body: string
  onBack: () => void
}

const Error = (props: Props) => (
  <Wrapper onBack={() => {}}>
    <Kb.Text center={true} type="Header" style={{maxWidth: 460, width: '80%'}}>
      {props.header}
    </Kb.Text>
    <Kb.Text type="Body" center={true}>
      {props.body}
    </Kb.Text>
    <ContinueButton label="Back" onClick={props.onBack} />
  </Wrapper>
)

export default Error
