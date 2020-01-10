import * as React from 'react'
import * as Container from '../../../util/container'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Types from '../../../constants/types/chat2'
import * as Kb from '../../../common-adapters'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  username: string
}

const AddBotToChannel = ({conversationIDKey, username}: Props) => {
  const dispatch = Container.useDispatch()
  const addToChannel = () =>
    dispatch(Chat2Gen.createAddUsersToChannel({conversationIDKey, usernames: [username]}))
  return (
    <Kb.WithTooltip tooltip="Add to this channel">
      <Kb.Icon type="iconfont-add" onClick={addToChannel} />
    </Kb.WithTooltip>
  )
}

export default AddBotToChannel
