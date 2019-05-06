// @flow
import React from 'react'
import * as Styles from '../../../styles'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Constants from '../../../constants/chat2'
import Text from '../../../common-adapters/text'
import {namedConnect} from '../../../util/container'
import Mention from '../../../common-adapters/mention-container'
import TeamMention from './team-container'
import UnknownMention from './unknown'

const Kb = {Text}

type Props = {|
  allowFontScaling?: boolean,
  channel: string,
  info: ?RPCChatTypes.UIMaybeMentionInfo,
  name: string,
  style?: Styles.StylesCrossPlatform,
|}

const MaybeMention = (props: Props) => {
  if (!props.info) {
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
    case RPCChatTypes.chatUiUIMaybeMentionStatus.unknown:
      return (
        <UnknownMention
          allowFontScaling={props.allowFontScaling}
          channel={props.channel}
          name={props.name}
          style={props.style}
        />
      )
    case RPCChatTypes.chatUiUIMaybeMentionStatus.user:
      return <Mention username={props.name} />
    case RPCChatTypes.chatUiUIMaybeMentionStatus.team:
      return (
        <TeamMention
          allowFontScaling={props.allowFontScaling}
          style={props.style}
          name={props.name}
          channel={props.channel}
        />
      )
  }
  return null
}

type OwnProps = {|
  allowFontScaling?: boolean,
  channel: string,
  name: string,
  style?: Styles.StylesCrossPlatform,
|}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const info = state.chat2.maybeMentionMap.get(Constants.getTeamMentionName(ownProps.name, ownProps.channel))
  return {
    ...ownProps,
    info,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(mapStateToProps, d => ({}), s => ({...s}), 'MaybeMention')(
  MaybeMention
)
