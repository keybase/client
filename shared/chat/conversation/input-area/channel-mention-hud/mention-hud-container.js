// @flow
import {MentionHud} from '.'
import {compose, connect, type TypedState, setDisplayName} from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'

const mapStateToProps = (state: TypedState, {filter, conversationIDKey}) => {
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

export default compose(
  connect(
    mapStateToProps,
    () => ({}),
    mergeProps
  ),
  setDisplayName('ChannelMentionHud')
)(MentionHud)
