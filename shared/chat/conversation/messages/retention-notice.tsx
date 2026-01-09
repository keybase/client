import type * as T from '@/constants/types'
import * as Chat from '@/stores/chat2'
import * as Teams from '@/stores/teams'
import * as Kb from '@/common-adapters'
import * as React from 'react'

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
  const meta = Chat.useChatContext(s => s.meta)
  const {teamType, retentionPolicy: policy, teamRetentionPolicy: teamPolicy} = meta
  const canChange = Teams.useTeamsState(s => {
    return meta.teamType !== 'adhoc' ? Teams.getCanPerformByID(s, meta.teamID).setRetentionPolicy : true
  })
  const showInfoPanel = Chat.useChatContext(s => s.dispatch.showInfoPanel)
  const onChange = React.useCallback(() => showInfoPanel(true, 'settings'), [showInfoPanel])
  const explanation = makeRetentionNotice(policy, teamPolicy, teamType) ?? undefined

  const iconType =
    policy.type === 'explode' || (policy.type === 'inherit' && teamPolicy.type === 'explode')
      ? 'iconfont-bomb-solid'
      : 'iconfont-timer-solid'

  return (
    <Kb.Box style={styles.container}>
      <Kb.Box style={styles.iconBox}>
        <Kb.Icon color={Kb.Styles.globalColors.black_20} fontSize={20} type={iconType} />
      </Kb.Box>
      {!!explanation && (
        <Kb.Text center={true} type="BodySmallSemibold">
          {explanation}
        </Kb.Text>
      )}
      {canChange && (
        <Kb.Text
          type="BodySmallSemiboldPrimaryLink"
          style={{color: Kb.Styles.globalColors.blueDark}}
          onClick={onChange}
        >
          Change this
        </Kb.Text>
      )}
    </Kb.Box>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'center',
        backgroundColor: Kb.Styles.globalColors.blueLighter3,
        paddingBottom: Kb.Styles.globalMargins.small,
        paddingLeft: Kb.Styles.globalMargins.medium,
        paddingRight: Kb.Styles.globalMargins.medium,
        paddingTop: Kb.Styles.globalMargins.small,
        width: '100%',
      },
      iconBox: {marginBottom: Kb.Styles.globalMargins.xtiny},
    }) as const
)
export default RetentionNoticeContainer
