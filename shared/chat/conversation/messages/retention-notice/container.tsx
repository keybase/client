import * as C from '../../../../constants'
import * as React from 'react'
import * as TeamConstants from '../../../../constants/teams'
import RetentionNotice from '.'
import {makeRetentionNotice} from '../../../../util/teams'

const RetentionNoticeContainer = React.memo(function RetentionNoticeContainer() {
  const meta = C.useChatContext(s => s.meta)
  const {teamType, retentionPolicy, teamRetentionPolicy} = meta
  const canChange = C.useTeamsState(s => {
    return meta.teamType !== 'adhoc'
      ? TeamConstants.getCanPerformByID(s, meta.teamID).setRetentionPolicy
      : true
  })

  const showInfoPanel = C.useChatContext(s => s.dispatch.showInfoPanel)
  const onChange = React.useCallback(() => showInfoPanel(true, 'settings'), [showInfoPanel])
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
