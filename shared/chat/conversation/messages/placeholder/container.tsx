import * as React from 'react'
import type * as Types from '../../../../constants/types/chat2'
import MessagePlaceholder from '.'

const PlaceholderContainer = React.memo(function PlaceholderContainer(props: {message: Types.Message}) {
  const {ordinal} = props.message
  return <MessagePlaceholder key={String(ordinal)} ordinal={ordinal} />
})
export default PlaceholderContainer
