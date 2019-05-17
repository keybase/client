// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Flow from '../../util/flow'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'

/*
 * This banner is used as part of a List2 in fs/row/rows.js, so it's important
 * to keep height stable, thus all the height/minHeight/maxHeight in styles.
 * Please make sure the height is still calculated in getHeight when layout
 * changes.
 *
 */
export const getHeight = (conflictState: Types.ConflictState): number =>
  conflictState.type === 'none' ? 0 : 50

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
  switch (conflictState.type) {
    case 'automatic':
      return conflictState.isStuck
        ? 'Your changes to this folder conflict with changes made to this' +
            ' folder on the server. Automatic conflict resolution has failed, so' +
            ' you may need to manually resolve the conflict. This is not' +
            ' supposed to happen!'
        : 'Your changes to this folder conflict with changes made to this' +
            ' folder on the server. We are trying to fix it automatically, but' +
            ' you may need to manually resolve the conflict. This is not' +
            ' supposed to happen!'
    case 'manual-local-view':
      return 'This is your local view of the conflicted folder.'
    case 'manual-server-view':
      return "This is the server's view of the conflicted folder."
    case 'none':
      return 'This should not happen.'
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(conflictState.type)
      return 'Unknown conflictState type: ' + conflictState.type
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
  switch (props.conflictState.type) {
    case 'automatic':
      actions = props.conflictState.isStuck
        ? [startRes, feedbackAction, helpAction]
        : [startRes, feedbackAction, helpAction]
      break
    case 'manual-server-view':
      actions = [onSeeOtherView, finishRes, feedbackAction, helpAction]
      break
    case 'manual-local-view':
      actions = [onSeeOtherView, finishRes, feedbackAction, helpAction]
      break
    case 'none':
      actions = [feedbackAction]
      break
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.conflictState.type)
  }
  return (
    props.conflictState !== Constants.conflictStateNone && (
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
