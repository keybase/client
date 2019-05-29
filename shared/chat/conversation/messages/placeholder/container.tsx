import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import MessagePlaceholder from '.'

const Wrapper = (props: {message: Types.Message}) => (
  <MessagePlaceholder key={String(props.message.ordinal)} ordinal={props.message.ordinal} />
)
export default Wrapper
