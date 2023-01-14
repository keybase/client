import * as React from 'react'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import type * as ChatTypes from '../../../../constants/types/chat2'
import * as Container from '../../../../util/container'
import * as TeamConstants from '../../../../constants/teams'
import RetentionNotice from '.'
import {getMeta} from '../../../../constants/chat2'
import {makeRetentionNotice} from '../../../../util/teams'
import shallowEqual from 'shallowequal'

type OwnProps = {conversationIDKey: ChatTypes.ConversationIDKey}

const RetentionNoticeContainer = React.memo(function RetentionNoticeContainer(p: OwnProps) {
  const {conversationIDKey} = p

  const {canChange, teamType, retentionPolicy, teamRetentionPolicy} = Container.useSelector(state => {
    const meta = getMeta(state, conversationIDKey)
    const canChange =
      meta.teamType !== 'adhoc'
        ? TeamConstants.getCanPerformByID(state, meta.teamID).setRetentionPolicy
        : true
    const {teamType, retentionPolicy, teamRetentionPolicy} = meta
    return {canChange, retentionPolicy, teamRetentionPolicy, teamType}
  }, shallowEqual)

  const dispatch = Container.useDispatch()
  const onChange = React.useCallback(
    () => dispatch(Chat2Gen.createShowInfoPanel({conversationIDKey, show: true, tab: 'settings'})),
    [dispatch, conversationIDKey]
  )
  const explanation = makeRetentionNotice(retentionPolicy, teamRetentionPolicy, teamType) ?? undefined

  const props = {
    canChange,
    explanation,
    onChange,
    policy: retentionPolicy,
    teamPolicy: teamRetentionPolicy,
  }
  return <RetentionNotice {...props} />
})
export default RetentionNoticeContainer
