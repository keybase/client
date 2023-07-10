import * as React from 'react'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import type * as ChatTypes from '../../../../constants/types/chat2'
import * as Container from '../../../../util/container'
import * as TeamConstants from '../../../../constants/teams'
import RetentionNotice from '.'
import {getMeta} from '../../../../constants/chat2'
import {makeRetentionNotice} from '../../../../util/teams'

type OwnProps = {conversationIDKey: ChatTypes.ConversationIDKey}

const RetentionNoticeContainer = React.memo(function RetentionNoticeContainer(p: OwnProps) {
  const {conversationIDKey} = p

  const meta = Container.useSelector(state => {
    return getMeta(state, conversationIDKey)
  })
  const {teamType, retentionPolicy, teamRetentionPolicy} = meta
  const canChange = TeamConstants.useState(s => {
    return meta.teamType !== 'adhoc'
      ? TeamConstants.getCanPerformByID(s, meta.teamID).setRetentionPolicy
      : true
  })

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
