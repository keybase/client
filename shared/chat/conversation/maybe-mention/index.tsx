import * as C from '../../../constants'
import * as T from '../../../constants/types'
import * as Constants from '../../../constants/chat2'
import Text, {type StylesTextCrossPlatform} from '../../../common-adapters/text'
import Mention from '../../../common-adapters/mention-container'
import TeamMention from './team-container'
import UnknownMention from './unknown'

const Kb = {Mention, Text}

type Props = {
  allowFontScaling?: boolean
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
      <Kb.Text type="Body" style={props.style} allowFontScaling={props.allowFontScaling}>
        {text}
      </Kb.Text>
    )
  }
  switch (props.info.status) {
    case T.RPCChat.UIMaybeMentionStatus.unknown:
      return (
        <UnknownMention
          allowFontScaling={props.allowFontScaling}
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
          allowFontScaling={props.allowFontScaling}
          style={props.style}
          name={props.name}
          channel={props.channel}
        />
      )
  }
}

type OwnProps = {
  allowFontScaling?: boolean
  channel: string
  name: string
  style?: StylesTextCrossPlatform
}

export default (ownProps: OwnProps) => {
  const {name, channel} = ownProps
  const info = C.useChatState(s => s.maybeMentionMap.get(Constants.getTeamMentionName(name, channel)))
  const resolveMaybeMention = C.useChatContext(s => s.dispatch.resolveMaybeMention)
  const onResolve = () => {
    resolveMaybeMention(channel, name)
  }
  const props = {
    allowFontScaling: ownProps.allowFontScaling,
    channel: ownProps.channel,
    info,
    name: ownProps.name,
    onResolve,
    style: ownProps.style,
  }
  return <MaybeMention {...props} />
}
