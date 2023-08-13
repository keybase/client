import * as C from '../../../../constants'
import * as React from 'react'
import type * as ChatTypes from '../../../../constants/types/chat2'
import * as TeamConstants from '../../../../constants/teams'
import * as Constants from '../../../../constants/chat2'
import RetentionNotice from '.'
import {makeRetentionNotice} from '../../../../util/teams'

type OwnProps = {conversationIDKey: ChatTypes.ConversationIDKey}

const RetentionNoticeContainer = React.memo(function RetentionNoticeContainer(p: OwnProps) {
  const {conversationIDKey} = p
  const meta = Constants.useContext(s => s.meta)
  const {teamType, retentionPolicy, teamRetentionPolicy} = meta
  const canChange = C.useTeamsState(s => {
    return meta.teamType !== 'adhoc'
      ? TeamConstants.getCanPerformByID(s, meta.teamID).setRetentionPolicy
      : true
  })

  const showInfoPanel = C.useChatState(s => s.dispatch.showInfoPanel)
  const onChange = React.useCallback(
    () => showInfoPanel(true, 'settings', conversationIDKey),
    [showInfoPanel, conversationIDKey]
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
