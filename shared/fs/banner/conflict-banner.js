// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Flow from '../../util/flow'
import * as Types from '../../constants/types/fs'

/*
 * This banner is used as part of a List2 in fs/row/rows.js, so it's important
 * to keep height stable, thus all the height/minHeight/maxHeight in styles.
 * Please make sure the height is still calculated in getHeight when layout
 * changes.
 *
 */
export const getHeight = (conflictState: Types.ConflictState): number => (conflictState === 'none' ? 0 : 50)

type Props = {
  conflictState: Types.ConflictState,
  onStartResolving: () => void,
  onSeeOtherView: () => void,
  isUnmergedView: boolean,
  onFinishResolving: () => void,
  onFeedback: () => void,
  onHelp: () => void,
}

const getMessage = (conflictState, isUnmerged): string => {
  switch (conflictState) {
    case 'in-conflict-stuck':
      return (
        'Your changes to this folder conflict with changes made to this' +
        ' folder on the server. Automatic conflict resolution has failed, so' +
        ' you may need to manually resolve the conflict. This is not' +
        ' supposed to happen!'
      )
    case 'in-conflict-not-stuck':
      return (
        'Your changes to this folder conflict with changes made to this' +
        ' folder on the server. We are trying to fix it automatically, but' +
        ' you may need to manually resolve the conflict. This is not' +
        ' supposed to happen!'
      )
    case 'in-manual-resolution':
      return isUnmerged
        ? 'This is your local view of the conflicted folder.'
        : "This is the server's view of the conflicted folder."
    case 'finishing':
      return 'Finishing conflict resolution...'
    case 'none':
      return 'This should not happen.'
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(conflictState)
      return 'This should not happen.'
  }
}

const fixedHeight = height => ({
  height,
  maxHeight: height,
  minHeight: height,
})

const ConflictBanner = (props: Props) => {
  const helpAction = {onClick: props.onHelp, title: 'What does this mean?'}
  const feedbackAction = {onClick: props.onFeedback, title: 'Let us know'}
  const startRes = {onClick: props.onStartResolving, title: 'Start resolving'}
  const finishRes = {onClick: props.onFinishResolving, title: 'Finish resolving'}
  const onSeeServerView = {onClick: props.onSeeOtherView, title: "See the server's view"}
  const onSeeLocalView = {onClick: props.onSeeOtherView, title: 'See local changes'}
  const onSeeOtherView = props.isUnmergedView ? onSeeServerView : onSeeLocalView

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
      actions = [onSeeOtherView, finishRes, feedbackAction, helpAction]
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
        text={getMessage(props.conflictState, props.isUnmergedView)}
        color="red"
        actions={actions}
        style={fixedHeight(getHeight(props.conflictState))}
      />
    )
  )
}

export default ConflictBanner
