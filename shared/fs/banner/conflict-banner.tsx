import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {openURL as openUrl} from '@/util/misc'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

type OwnProps = {
  path: T.FS.Path
}

const ConnectedBanner = (ownProps: OwnProps) => {
  const {path} = ownProps
  const _tlf = useFSState(s => FS.getTlfFromPath(s.tlfs, path))
  const finishManualConflictResolution = useFSState(s => s.dispatch.finishManualConflictResolution)
  const startManualConflictResolution = useFSState(s => s.dispatch.startManualConflictResolution)
  const navigateAppend = C.Router2.navigateAppend
  const onFinishResolving = () => {
    finishManualConflictResolution(path)
  }
  const onGoToSamePathInDifferentTlf = (tlfPath: T.FS.Path) => {
    navigateAppend({name: 'fsRoot', params: {path: FS.rebasePathToDifferentTlf(path, tlfPath)}})
  }
  const onHelp = () => {
    openUrl('https://book.keybase.io/docs/files/details#conflict-resolution')
  }
  const onStartResolving = () => {
    startManualConflictResolution(path)
  }

  const openPathInSystemFileManagerDesktop = useFSState(
    s => s.dispatch.openPathInSystemFileManagerDesktop
  )

  const openInSystemFileManager = (path: T.FS.Path) => {
    openPathInSystemFileManagerDesktop?.(path)
  }

  const conflictState = _tlf.conflictState
  const finishRes = {onClick: onFinishResolving, text: ' Delete this conflict view '}
  const helpAction = {onClick: onHelp, text: ' What does this mean? '}
  const startRes = {onClick: onStartResolving, text: ' Resolve conflict '}

  switch (conflictState.type) {
    case T.FS.ConflictStateType.NormalView: {
      if (conflictState.stuckInConflict) {
        const color = conflictState.localViewTlfPaths.length ? 'red' : 'yellow'
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
      if (conflictState.localViewTlfPaths.length) {
        const localViewCount = conflictState.localViewTlfPaths.length
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
              content={conflictState.localViewTlfPaths.map((tlfPath, idx) => ({
                onClick: () => onGoToSamePathInDifferentTlf(tlfPath),
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
      return (
        <Kb.Banner color="yellow">
          <Kb.BannerParagraph
            bannerColor="yellow"
            content={[
              'This is a conflicted copy of ',
              {
                onClick: () => onGoToSamePathInDifferentTlf(conflictState.normalViewTlfPath),
                text: T.FS.pathToString(conflictState.normalViewTlfPath),
              },
              '.',
            ]}
          />
          <Kb.BannerParagraph
            bannerColor="yellow"
            content={[
              {
                onClick: () => openInSystemFileManager(conflictState.normalViewTlfPath),
                text: ` Open in ${C.fileUIName} `,
              },
              finishRes,
              helpAction,
            ]}
          />
        </Kb.Banner>
      )
    }
    default:
      return <Kb.Text type="Body">{'Unknown conflictState: ' + conflictState}</Kb.Text>
  }
}

export default ConnectedBanner
