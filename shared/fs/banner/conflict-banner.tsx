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
  feedbackAction: {onClick: props.onFeedback, text: ' Please let us know '},
  finishRes: {onClick: props.onFinishResolving, text: ' Delete this conflict view '},
  helpAction: {onClick: props.onHelp, text: ' What does this mean? '},
  startRes: {onClick: props.onStartResolving, text: ' Start resolving '},
})

const ConflictBanner = (props: Props) => {
  switch (props.conflictState.type) {
    case Types.ConflictStateType.NormalView: {
      const {feedbackAction, helpAction, startRes} = getActions(props)
      if (props.conflictState.stuckInConflict) {
        const color = props.conflictState.localViewTlfPaths.length ? 'red' : 'yellow'
        return (
          <Kb.Banner color={color}>
            <Kb.BannerParagraph
              bannerColor={color}
              content={
                (props.conflictState.localViewTlfPaths.length
                  ? `This is the rest of the world's view of ${props.tlfPath}. Your changes to this view`
                  : `Your changes to ${props.tlfPath}`) +
                ' conflict with changes made to this folder on another device. ' +
                'Automatic conflict resolution has failed,' +
                ' so you need to manually resolve the conflict. ' +
                'This is not supposed to happen! '
              }
            />
            <Kb.BannerParagraph bannerColor={color} content={[startRes, feedbackAction, helpAction]} />
          </Kb.Banner>
        )
      }
      if (props.conflictState.localViewTlfPaths.length) {
        const localViewCount = props.conflictState.localViewTlfPaths.length
        return (
          <Kb.Banner color="red">
            <Kb.BannerParagraph
              bannerColor="red"
              content={
                `This is the rest of the world's view of ${props.tlfPath}.` +
                " When you're satisfied with this view, you can delete the local conflict view. "
              }
            />
            <Kb.BannerParagraph
              bannerColor="red"
              content={[
                ...props.conflictState.localViewTlfPaths.map((tlfPath, idx) => ({
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
            content={
              `You're resolving a conflict in ${props.tlfPath}. This is your local view.` +
              'You should make sure to copy any changes you want to keep into' +
              ' the global view before clearing away this view. '
            }
          />
          <Kb.BannerParagraph
            bannerColor="yellow"
            content={[onSeeGlobalView, finishRes, feedbackAction, helpAction]}
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
