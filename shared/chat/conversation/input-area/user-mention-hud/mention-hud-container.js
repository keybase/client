// @flow
import {MentionHud} from '.'
import {compose, connect, type TypedState, setDisplayName} from '../../../../util/container'
import * as I from 'immutable'

const mapStateToProps = (state: TypedState, {filter, conversationIDKey}) => {
  return {
    _filter: filter,
    _infoMap: state.users.infoMap,
    _metaMap: state.chat2.metaMap,
    conversationIDKey,
  }
}

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const meta = stateProps._metaMap.get(stateProps.conversationIDKey)
  let participants = meta ? meta.participants : I.Set()
  // Get the general channel participants instead
  if (meta && meta.teamType === 'big' && meta.channelname !== 'general') {
    const m = stateProps._metaMap.find(m => m.teamname === meta.teamname && m.channelname === 'general')
    if (m) {
      participants = m.participants
    }
  }

  return {
    ...ownProps,
    conversationIDKey: stateProps.conversationIDKey,
    filter: stateProps._filter.toLowerCase(),
    users: participants
      .map(p => ({fullName: stateProps._infoMap.getIn([p, 'fullname'], ''), username: p}))
      .toArray(),
  }
}

export default compose(connect(mapStateToProps, () => ({}), mergeProps), setDisplayName('UserMentionHud'))(
  MentionHud
)
