// @flow
import {MentionHud} from '.'
import {namedConnect} from '../../../../util/container'
import * as Styles from '../../../../styles'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
  filter: string,
  selectDownCounter?: number,
  selectUpCounter?: number,
  pickSelectedChannelCounter?: number,
  onPickChannel?: (c: string, options?: {notChannel: boolean}) => void,
  onSelectChannel?: (c: string) => void,
  setChannelMentionHudIsShowing: boolean => void,
  style?: Styles.StylesCrossPlatform,
|}

const mapStateToProps = (state, {filter, conversationIDKey}) => {
  const meta = Constants.getMeta(state, conversationIDKey)
  return {
    _metaMap: state.chat2.metaMap,
    _teamname: meta.teamname,
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const channels = stateProps._metaMap.reduce((arr, meta) => {
    // only if we're in a team
    if (stateProps._teamname && meta.teamname === stateProps._teamname) {
      arr.push(meta.channelname)
    }
    return arr
  }, [])
  return {
    ...ownProps,
    channels,
    filter: ownProps.filter.toLowerCase(),
  }
}

export default namedConnect<OwnProps, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  mergeProps,
  'ChannelMentionHud'
)(MentionHud)
