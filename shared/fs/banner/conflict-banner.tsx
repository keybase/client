import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Flow from '../../util/flow'
import * as Types from '../../constants/types/fs'

export type Props = {
  conflictState: Types.ConflictState
  onFeedback: () => void
  onFinishResolving: () => void
  onGoToSamePathInDifferentTlf: (tlfPath: Types.Path) => void
  onHelp: () => void
  onStartResolving: () => void
  tlfPath: Types.Path
}

const getActions = (props: Props) => ({
  feedbackAction: {onClick: props.onFeedback, title: 'Please let us know'},
  finishRes: {onClick: props.onFinishResolving, title: 'Delete this conflict view'},
  helpAction: {onClick: props.onHelp, title: 'What does this mean?'},
  startRes: {onClick: props.onStartResolving, title: 'Start resolving'},
})

const ConflictBanner = (props: Props) => {
  switch (props.conflictState.type) {
    case Types.ConflictStateType.NormalView: {
      const {feedbackAction, helpAction, startRes} = getActions(props)
      if (props.conflictState.stuckInConflict) {
        return (
          <Kb.Banner
            color={props.conflictState.localViewTlfPaths.size ? 'red' : 'yellow'}
            actions={[startRes, feedbackAction, helpAction]}
            text={
              (props.conflictState.localViewTlfPaths.size
                ? `This is the rest of the world's view of ${props.tlfPath}. Your changes to this view`
                : `Your changes to ${props.tlfPath}`) +
              ' conflict with changes made to this folder on another device. ' +
              'Automatic conflict resolution has failed,' +
              ' so you need to manually resolve the conflict. ' +
              'This is not supposed to happen!'
            }
          />
        )
      }
      if (props.conflictState.localViewTlfPaths.size) {
        const localViewCount = props.conflictState.localViewTlfPaths.size
        const {feedbackAction, helpAction} = getActions(props)
        return (
          <Kb.Banner
            color="red"
            actions={[
              ...props.conflictState.localViewTlfPaths.toArray().map((tlfPath, idx) => ({
                onClick: () => props.onGoToSamePathInDifferentTlf(tlfPath),
                title:
                  'See local changes' +
                  (localViewCount > 1 ? ` (version ${(idx + 1).toString()} of ${localViewCount}` : ''),
              })),
              feedbackAction,
              helpAction,
            ]}
            text={
              `This is the rest of the world's view of ${props.tlfPath}.` +
              " When you're satisfied with this view, you can delete the local conflict view."
            }
          />
        )
      }
      return null
    }
    case Types.ConflictStateType.ManualResolvingLocalView: {
      const {feedbackAction, finishRes, helpAction} = getActions(props)
      const onSeeGlobalView = {
        onClick: () => props.onGoToSamePathInDifferentTlf(props.tlfPath),
        title: 'See the global view',
      }
      return (
        <Kb.Banner
          color="yellow"
          actions={[onSeeGlobalView, finishRes, feedbackAction, helpAction]}
          text={
            `You're resolving a conflict in ${props.tlfPath}. This is your local view.` +
            'You should make sure to copy any changes you want to keep into' +
            ' the global view before clearing away this view.'
          }
        />
      )
    }
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.conflictState)
      return <Kb.Text type="Body">'Unknown conflictState: ' + conflictState</Kb.Text>
  }
}

export default ConflictBanner
