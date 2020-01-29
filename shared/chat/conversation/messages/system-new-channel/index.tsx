import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import UserNotice from '../user-notice'

type Props = {
  channelname: string
  creator: string
  onViewChannel: () => void
  you: string
}

const NewChannel = (props: Props) => {
  const {creator, channelname, you} = props
  return (
    <UserNotice>
      <Kb.Text type="BodySmall">
        {creator === you ? 'You' : ''} created a new channel{' '}
        <Kb.Text onClick={props.onViewChannel} type="BodySmallSemiboldPrimaryLink">
          #{channelname}
        </Kb.Text>
      </Kb.Text>
    </UserNotice>
  )
}

export default NewChannel
