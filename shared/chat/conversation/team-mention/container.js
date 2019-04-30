// @flow
import * as Styles from '../../../styles'
import {namedConnect} from '../../../util/container'
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
    description: mentionInfo?.description || '',
    isOpen: mentionInfo?.open || false,
    name,
    numMembers: mentionInfo?.numMembers || 0,
    publicAdmins: mentionInfo?.publicAdmins ?? [],
    resolved: !!mentionInfo,
    style,
  }
}

export default namedConnect<OwnProps, _, _, _, _>(mapStateToProps, d => {}, s => s, 'TeamMention')(
  TeamMention
)
