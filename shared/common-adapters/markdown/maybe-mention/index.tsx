import * as Chat from '@/stores/chat2'
import * as T from '@/constants/types'
import {Text3} from '@/common-adapters/text3'
import type {StylesTextCrossPlatform} from '@/common-adapters/text'
import Mention from '../../mention-container'
import TeamMention from './team'
import UnknownMention from './unknown'

const Kb = {Mention, Text3}

type Props = {
  channel: string
  info?: T.RPCChat.UIMaybeMentionInfo
  name: string
  onResolve: () => void
  style?: StylesTextCrossPlatform
}

const MaybeMention = (props: Props) => {
  if (!props.info || props.info.status === T.RPCChat.UIMaybeMentionStatus.nothing) {
    let text = `@${props.name}`
    if (props.channel.length > 0) {
      text += `#${props.channel}`
    }
    return (
      <Kb.Text3 type="Body" style={props.style}>
        {text}
      </Kb.Text3>
    )
  }
  switch (props.info.status) {
    case T.RPCChat.UIMaybeMentionStatus.unknown:
      return (
        <UnknownMention
          channel={props.channel}
          name={props.name}
          onResolve={props.onResolve}
          style={props.style}
        />
      )
    case T.RPCChat.UIMaybeMentionStatus.user:
      return <Kb.Mention username={props.name} />
    case T.RPCChat.UIMaybeMentionStatus.team:
      return (
        <TeamMention
          style={props.style}
          name={props.name}
          channel={props.channel}
        />
      )
  }
}

type OwnProps = {
  channel: string
  name: string
  style?: StylesTextCrossPlatform
}

const Container = (ownProps: OwnProps) => {
  const {name, channel} = ownProps
  const info = Chat.useChatState(s => s.maybeMentionMap.get(Chat.getTeamMentionName(name, channel)))
  const resolveMaybeMention = Chat.useChatContext(s => s.dispatch.resolveMaybeMention)
  const onResolve = () => {
    resolveMaybeMention(channel, name)
  }
  const props = {
    channel: ownProps.channel,
    info,
    name: ownProps.name,
    onResolve,
    style: ownProps.style,
  }
  return <MaybeMention {...props} />
}

export default Container
