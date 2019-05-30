import * as React from 'react'
import Root from './root'
import {SendBody, RequestBody} from './body/container'

type Props = {
  isRequest: boolean
  onClose: () => void
}

const SendRequestForm = (props: Props) => (
  <Root isRequest={props.isRequest} onClose={props.onClose}>
    {props.isRequest ? <RequestBody /> : <SendBody />}
  </Root>
)

export default SendRequestForm
