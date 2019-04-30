// @flow
import * as React from 'react'
import {namedConnect} from '../../util/container'
import TeamMention from '.'

type OwnProps = {|
  allowFontScaling?: boolean,
  channel: string,
  name: string,
  style?: Styles.StylesCrossPlatform,
|}

const mapStateToProps = (state, {allowFontScaling, name, channel, style}: OwnProps) => {
  const mentionInfo = state.chat2.teamMentionMap.get(name)
  return {
    allowFontScaling,
    channel,
    description: mentionInfo?.description,
    isOpen: mentionInfo?.open,
    name,
    resolved: !!mentionInfo,
    numMembers: mentionInfo?.numMembers,
    publicAdmins: mentionInfo?.publicAdmins ?? [],
    style,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(mapStateToProps, d => {}, s => s, 'TeamMention')(
  TeamMention
)
