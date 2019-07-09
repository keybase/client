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
  feedbackAction: {onClick: props.onFeedback, spaceBefore: true, text: 'Please let us know'},
  finishRes: {onClick: props.onFinishResolving, spaceBefore: true, text: 'Delete this conflict view'},
  helpAction: {onClick: props.onHelp, spaceBefore: true, text: 'What does this mean?'},
  startRes: {onClick: props.onStartResolving, spaceBefore: true, text: 'Start resolving'},
})

const ConflictBanner = (props: Props) => {
  switch (props.conflictState.type) {
    case Types.ConflictStateType.NormalView: {
      const {feedbackAction, helpAction, startRes} = getActions(props)
      if (props.conflictState.stuckInConflict) {
        const color = props.conflictState.localViewTlfPaths.size ? 'red' : 'yellow'
        return (
          <Kb.Banner color={color}>
            <Kb.BannerParagraph
              bannerColor={color}
              content={[
                (props.conflictState.localViewTlfPaths.size
                  ? `This is the rest of the world's view of ${props.tlfPath}. Your changes to this view`
                  : `Your changes to ${props.tlfPath}`) +
                  ' conflict with changes made to this folder on another device. ' +
                  'Automatic conflict resolution has failed,' +
                  ' so you need to manually resolve the conflict. ' +
                  'This is not supposed to happen! ',
                startRes,
                feedbackAction,
                helpAction,
              ]}
            />
          </Kb.Banner>
        )
      }
      if (props.conflictState.localViewTlfPaths.size) {
        const localViewCount = props.conflictState.localViewTlfPaths.size
        const {feedbackAction, helpAction} = getActions(props)
        return (
          <Kb.Banner color="red">
            <Kb.BannerParagraph
              bannerColor="red"
              content={[
                `This is the rest of the world's view of ${props.tlfPath}.` +
                  " When you're satisfied with this view, you can delete the local conflict view. ",
                ...props.conflictState.localViewTlfPaths.toArray().map((tlfPath, idx) => ({
                  onClick: () => props.onGoToSamePathInDifferentTlf(tlfPath),
                  spaceBefore: true,
                  text:
                    'See local changes' +
                    (localViewCount > 1 ? ` (version ${(idx + 1).toString()} of ${localViewCount}` : ''),
                })),
                feedbackAction,
                helpAction,
              ]}
            />
          </Kb.Banner>
        )
      }
      return null
    }
    case Types.ConflictStateType.ManualResolvingLocalView: {
      const {feedbackAction, finishRes, helpAction} = getActions(props)
      const onSeeGlobalView = {
        onClick: () => props.onGoToSamePathInDifferentTlf(props.tlfPath),
        spaceBefore: true,
        text: 'See the global view',
      }
      return (
        <Kb.Banner color="yellow">
          <Kb.BannerParagraph
            bannerColor="yellow"
            content={[
              `You're resolving a conflict in ${props.tlfPath}. This is your local view.` +
                'You should make sure to copy any changes you want to keep into' +
                ' the global view before clearing away this view. ',
              onSeeGlobalView,
              finishRes,
              feedbackAction,
              helpAction,
            ]}
          />
        </Kb.Banner>
      )
    }
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.conflictState)
      return <Kb.Text type="Body">'Unknown conflictState: ' + conflictState</Kb.Text>
  }
}

export default ConflictBanner
