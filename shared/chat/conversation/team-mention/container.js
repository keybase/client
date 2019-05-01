// @flow
import * as Styles from '../../../styles'
import * as TeamsGen from '../../../actions/teams-gen'
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
    inTeam: mentionInfo?.inTeam ?? false,
    isOpen: mentionInfo?.open || false,
    name,
    numMembers: mentionInfo?.numMembers || 0,
    publicAdmins: mentionInfo?.publicAdmins ?? [],
    resolved: !!mentionInfo,
    style,
  }
}

const mapDispatchToProps = dispatch => ({
  onJoinTeam: (teamname: string) => dispatch(TeamsGen.createJoinTeam({teamname})),
})

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d) => ({...s, ...d}),
  'TeamMention'
)(TeamMention)
