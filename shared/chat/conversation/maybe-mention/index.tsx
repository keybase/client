import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Constants from '../../../constants/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as Container from '../../../util/container'
import Text, {type StylesTextCrossPlatform} from '../../../common-adapters/text'
import Mention from '../../../common-adapters/mention-container'
import TeamMention from './team-container'
import UnknownMention from './unknown'

const Kb = {Mention, Text}

type Props = {
  allowFontScaling?: boolean
  channel: string
  info?: RPCChatTypes.UIMaybeMentionInfo
  name: string
  onResolve: () => void
  style?: StylesTextCrossPlatform
}

const MaybeMention = (props: Props) => {
  if (!props.info || props.info.status === RPCChatTypes.UIMaybeMentionStatus.nothing) {
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
    case RPCChatTypes.UIMaybeMentionStatus.unknown:
      return (
        <UnknownMention
          allowFontScaling={props.allowFontScaling}
          channel={props.channel}
          name={props.name}
          onResolve={props.onResolve}
          style={props.style}
        />
      )
    case RPCChatTypes.UIMaybeMentionStatus.user:
      return <Kb.Mention username={props.name} />
    case RPCChatTypes.UIMaybeMentionStatus.team:
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

export default Container.connect(
  (state, ownProps: OwnProps) => ({
    info: state.chat2.maybeMentionMap.get(Constants.getTeamMentionName(ownProps.name, ownProps.channel)),
  }),
  (dispatch, ownProps: OwnProps) => ({
    onResolve: () =>
      dispatch(Chat2Gen.createResolveMaybeMention({channel: ownProps.channel, name: ownProps.name})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => ({
    allowFontScaling: ownProps.allowFontScaling,
    channel: ownProps.channel,
    info: stateProps.info,
    name: ownProps.name,
    onResolve: dispatchProps.onResolve,
    style: ownProps.style,
  })
)(MaybeMention)
