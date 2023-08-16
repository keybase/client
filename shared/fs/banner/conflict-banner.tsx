import * as Kb from '../../common-adapters'
import * as T from '../../constants/types'
import {fileUIName} from '../../constants/platform'

export type Props = {
  conflictState: T.FS.ConflictState
  onFeedback: () => void
  onFinishResolving: () => void
  onGoToSamePathInDifferentTlf: (tlfPath: T.FS.Path) => void
  onHelp: () => void
  onStartResolving: () => void
  openInSystemFileManager: (path: T.FS.Path) => void
  tlfPath: T.FS.Path
}

const getActions = (props: Props) => ({
  feedbackAction: {onClick: props.onFeedback, text: ' Please let us know '},
  finishRes: {onClick: props.onFinishResolving, text: ' Delete this conflict view '},
  helpAction: {onClick: props.onHelp, text: ' What does this mean? '},
  startRes: {onClick: props.onStartResolving, text: ' Resolve conflict '},
})

const ConflictBanner = (props: Props) => {
  switch (props.conflictState.type) {
    case T.FS.ConflictStateType.NormalView: {
      const {helpAction, startRes} = getActions(props)
      if (props.conflictState.stuckInConflict) {
        const color = props.conflictState.localViewTlfPaths.length ? 'red' : 'yellow'
        return (
          <Kb.Banner color={color}>
            <Kb.BannerParagraph
              bannerColor={color}
              content={
                'Your changes to this folder' +
                ' conflict with changes made on another device. ' +
                'Automatic conflict resolution has failed,' +
                ' so you need to manually resolve the conflict. '
              }
            />
            <Kb.BannerParagraph bannerColor={color} content={[startRes, helpAction]} />
          </Kb.Banner>
        )
      }
      if (props.conflictState.localViewTlfPaths.length) {
        const localViewCount = props.conflictState.localViewTlfPaths.length
        return (
          <Kb.Banner color="green">
            <Kb.BannerParagraph
              bannerColor="green"
              content={
                localViewCount > 1
                  ? 'Local conflicted copies were created.'
                  : 'A local conflicted copy was created.'
              }
            />
            <Kb.BannerParagraph
              bannerColor="green"
              content={props.conflictState.localViewTlfPaths.map((tlfPath, idx) => ({
                onClick: () => props.onGoToSamePathInDifferentTlf(tlfPath),
                text: ' Open conflicted copy' + (localViewCount > 1 ? ` #${(idx + 1).toString()} ` : ' '),
              }))}
            />
            <Kb.BannerParagraph bannerColor="green" content={[helpAction]} />
          </Kb.Banner>
        )
      }
      return null
    }
    case T.FS.ConflictStateType.ManualResolvingLocalView: {
      const conflictState = props.conflictState
      const {finishRes, helpAction} = getActions(props)
      return (
        <Kb.Banner color="yellow">
          <Kb.BannerParagraph
            bannerColor="yellow"
            content={[
              'This is a conflicted copy of ',
              {
                onClick: () => props.onGoToSamePathInDifferentTlf(conflictState.normalViewTlfPath),
                text: T.FS.pathToString(conflictState.normalViewTlfPath),
              },
              '.',
            ]}
          />
          <Kb.BannerParagraph
            bannerColor="yellow"
            content={[
              {
                onClick: () => props.openInSystemFileManager(conflictState.normalViewTlfPath),
                text: ` Open in ${fileUIName} `,
              },
              finishRes,
              helpAction,
            ]}
          />
        </Kb.Banner>
      )
    }
    default:
      return <Kb.Text type="Body">'Unknown conflictState: ' + conflictState</Kb.Text>
  }
}

export default ConflictBanner
