// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as ChatTypes from '../../constants/types/chat2'
import * as Kb from '../../common-adapters'

type Props = {
  path: Types.Path,
  send: () => void,
  channels?: ?Array<{|convID: ChatTypes.ConversationIDKey, channelname: string|}>,
  setChannel?: ?(convID: ChatTypes.ConversationIDKey) => void,
}

const SendLinkToChat = (props: Props) => <Kb.Box2 direction="vertical">hi</Kb.Box2>
