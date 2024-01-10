import type * as T from '@/constants/types'
import * as C from '@/constants'
import * as React from 'react'
import RetentionNotice from '.'

// Parses retention policies into a string suitable for display at the top of a conversation
function makeRetentionNotice(
  policy: T.Retention.RetentionPolicy,
  teamPolicy: T.Retention.RetentionPolicy,
  teamType: 'adhoc' | 'big' | 'small'
): string | undefined {
  if (policy.type === 'retain' || (policy.type === 'inherit' && teamPolicy.type === 'retain')) {
    // Messages stick around forever; no explanation needed
    return
  }

  let convType = 'chat'
  if (teamType === 'big') {
    convType = 'channel'
  }
  let explanation = ''
  switch (policy.type) {
    case 'expire': {
      explanation = `will auto-delete after ${policy.title}.`
      break
    }
    case 'inherit': {
      explanation = `${teamPolicy.type === 'explode' ? 'will explode' : 'will auto-delete'} after ${
        teamPolicy.title
      }`
      explanation += teamType === 'small' ? '.' : ', the team default.'
      break
    }
    case 'explode': {
      explanation = `will explode after ${policy.title}.`
      break
    }
  }
  return `Messages in this ${convType} ${explanation}`
}

const RetentionNoticeContainer = React.memo(function RetentionNoticeContainer() {
  const meta = C.useChatContext(s => s.meta)
  const {teamType, retentionPolicy, teamRetentionPolicy} = meta
  const canChange = C.useTeamsState(s => {
    return meta.teamType !== 'adhoc' ? C.Teams.getCanPerformByID(s, meta.teamID).setRetentionPolicy : true
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
