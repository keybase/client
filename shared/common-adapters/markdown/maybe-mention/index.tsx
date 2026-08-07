import {ignorePromise} from '@/constants/utils'
import * as T from '@/constants/types'
import Text from '@/common-adapters/text'
import type {StylesTextCrossPlatform} from '@/common-adapters/text.shared'
import Mention from '../../mention'
import TeamMention from './team'
import UnknownMention from './unknown'
import {useMaybeMentionInfo} from './context'

const Kb = {Mention, Text}

type Props = {
  allowFontScaling?: boolean
  channel: string
  info?: T.RPCChat.UIMaybeMentionInfo
  name: string
  onResolve: () => void
  style?: StylesTextCrossPlatform
}

// Read every prop through one destructure: reaching through `props.x` in the body makes the react
// compiler key its memo on the whole props object, so a mention re-renders on every parent render.
const MaybeMention = (props: Props) => {
  const {allowFontScaling, channel, info, name, onResolve, style} = props
  if (!info || info.status === T.RPCChat.UIMaybeMentionStatus.nothing) {
    let text = `@${name}`
    if (channel.length > 0) {
      text += `#${channel}`
    }
    return (
      <Kb.Text type="Body" style={style} allowFontScaling={allowFontScaling}>
        {text}
      </Kb.Text>
    )
  }
  switch (info.status) {
    case T.RPCChat.UIMaybeMentionStatus.unknown:
      return (
        <UnknownMention
          allowFontScaling={allowFontScaling}
          channel={channel}
          name={name}
          onResolve={onResolve}
          style={style}
        />
      )
    case T.RPCChat.UIMaybeMentionStatus.user:
      return <Kb.Mention allowFontScaling={allowFontScaling} username={name} />
    case T.RPCChat.UIMaybeMentionStatus.team:
      return (
        <TeamMention
          allowFontScaling={allowFontScaling}
          style={style}
          name={name}
          channel={channel}
          mentionInfo={info.team}
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

const MaybeMentionContainer = (ownProps: OwnProps) => {
  const {name, channel} = ownProps
  const info = useMaybeMentionInfo(name, channel)
  const onResolve = () => {
    ignorePromise(T.RPCChat.localResolveMaybeMentionRpcPromise({mention: {channel, name}}))
  }
  return <MaybeMention {...ownProps} info={info} onResolve={onResolve} />
}

export default MaybeMentionContainer
