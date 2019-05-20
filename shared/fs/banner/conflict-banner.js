// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Flow from '../../util/flow'
import * as Types from '../../constants/types/fs'

type Props = {
  conflictState: Types.ConflictState,
  onStartResolving: () => void,
  onSeeOtherView: () => void,
  isUnmergedView: boolean,
  onFinishResolving: () => void,
  onFeedback: () => void,
  onHelp: () => void,
  tlfName: string,
}

const getMessage = (tlf, conflictState, isUnmerged): string => {
  switch (conflictState) {
    case 'in-conflict-stuck':
      return (
        `Your changes to ${tlf} conflict with changes made to this` +
        ' folder on another device. Automatic conflict resolution has failed,' +
        ' so you need to manually resolve the conflict. This is not' +
        ' supposed to happen!'
      )
    case 'in-conflict-not-stuck':
      return (
        `Your changes to ${tlf} conflict with changes made to this` +
        ' folder on another device. We are trying to fix it automatically,' +
        ' but you may need to manually resolve the conflict. This is not' +
        ' supposed to happen!'
      )
    case 'in-manual-resolution':
      return isUnmerged
        ? `This is your local view of the conflicted ${tlf}. When you click` +
            ' finish, this view will go away. You should make sure to copy any' +
            ' changes you want to keep into the global view'
        : `This is the rest of the world's view of ${tlf}.` +
            " When you're satisfied with this view, you can click finish."
    case 'finishing':
      return 'Finishing conflict resolution...'
    case 'none':
      return 'This should not happen.'
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(conflictState)
      return 'This should not happen.'
  }
}

const ConflictBanner = (props: Props) => {
  const helpAction = {onClick: props.onHelp, title: 'What does this mean?'}
  const feedbackAction = {onClick: props.onFeedback, title: 'Let us know'}
  const startRes = {onClick: props.onStartResolving, title: 'Start resolving'}
  const finishRes = {onClick: props.onFinishResolving, title: 'Finish resolving'}
  const onSeeGlobalView = {onClick: props.onSeeOtherView, title: 'See the global view'}
  const onSeeLocalView = {onClick: props.onSeeOtherView, title: 'See local changes'}

  let actions = []
  switch (props.conflictState) {
    case 'in-conflict-stuck':
      actions = [startRes, feedbackAction, helpAction]
      break
    case 'in-conflict-not-stuck':
      actions = [startRes, feedbackAction, helpAction]
      break
    case 'finishing':
      break
    case 'in-manual-resolution':
      if (props.isUnmergedView) {
        actions = [onSeeGlobalView, finishRes, feedbackAction, helpAction]
      } else {
        actions = [onSeeLocalView, finishRes, feedbackAction, helpAction]
      }
      break
    case 'none':
      actions = [feedbackAction]
      break
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.conflictState)
  }
  return (
    props.conflictState !== 'none' && (
      <Kb.Banner
        text={getMessage(props.tlfName, props.conflictState, props.isUnmergedView)}
        color="red"
        actions={actions}
      />
    )
  )
}

export default ConflictBanner
