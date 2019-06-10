import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Flow from '../../util/flow'
import * as Types from '../../constants/types/fs'

export type Props = {
  conflictState: Types.ConflictState
  onStartResolving: () => void
  onSeeOtherView: () => void
  isUnmergedView: boolean
  onFinishResolving: () => void
  onFeedback: () => void
  onHelp: () => void
  tlfPath: Types.Path
}

const getMessage = (tlf: string, conflictState: Types.ConflictState, isUnmerged): string => {
  switch (conflictState) {
    case Types.ConflictState.InConflictStuck:
      return (
        `Your changes to ${tlf} conflict with changes made to this` +
        ' folder on another device. Automatic conflict resolution has failed,' +
        ' so you need to manually resolve the conflict. This is not' +
        ' supposed to happen!'
      )
    case Types.ConflictState.InManualResolution:
      return isUnmerged
        ? `You're resolving a conflict in ${tlf}. This is your local view.` +
            'You should make sure to copy any changes you want to keep into' +
            ' the global view before clearing away this view.'
        : `This is the rest of the world's view of ${tlf}.` +
            " When you're satisfied with this view, you can delete the local conflict view."
    case Types.ConflictState.Finishing:
      return 'Finishing conflict resolution...'
    case Types.ConflictState.None:
    case Types.ConflictState.InConflictNotStuck:
      return 'This should not happen.'
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(conflictState)
      return 'Unknown conflictState: ' + conflictState
  }
}

const ConflictBanner = (props: Props) => {
  const helpAction = {onClick: props.onHelp, title: 'What does this mean?'}
  const feedbackAction = {onClick: props.onFeedback, title: 'Please let us know'}
  const startRes = {onClick: props.onStartResolving, title: 'Start resolving'}
  const finishRes = {onClick: props.onFinishResolving, title: 'Delete this conflict view'}
  const onSeeGlobalView = {onClick: props.onSeeOtherView, title: 'See the global view'}
  const onSeeLocalView = {onClick: props.onSeeOtherView, title: 'See local changes'}

  let actions = []
  switch (props.conflictState) {
    case Types.ConflictState.InConflictStuck:
      actions = [startRes, feedbackAction, helpAction]
      break
    case Types.ConflictState.Finishing:
      break
    case Types.ConflictState.InManualResolution:
      if (props.isUnmergedView) {
        actions = [onSeeGlobalView, finishRes, feedbackAction, helpAction]
      } else {
        actions = [onSeeLocalView, feedbackAction, helpAction]
      }
      break
    case Types.ConflictState.InConflictNotStuck:
    case Types.ConflictState.None:
      actions = [feedbackAction]
      break
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.conflictState)
  }
  return (
    props.conflictState !== Types.ConflictState.None &&
    props.conflictState !== Types.ConflictState.InConflictNotStuck && (
      <Kb.Banner
        text={getMessage(props.tlfPath, props.conflictState, props.isUnmergedView)}
        color="red"
        actions={actions}
      />
    )
  )
}

export default ConflictBanner
