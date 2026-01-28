import * as C from '@/constants'
import * as T from '@/constants/types'
import {useOpen} from '@/fs/common/use-open'
import {rowStyles, StillCommon} from './common'
import * as Kb from '@/common-adapters'
import {LastModifiedLine, Filename} from '@/fs/common'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

type OwnProps = {
  destinationPickerIndex?: number
  path: T.FS.Path
}

const getDownloadingText = (intent: T.FS.DownloadIntent) => {
  switch (intent) {
    case T.FS.DownloadIntent.None:
      return 'Downloading...'
    case T.FS.DownloadIntent.CameraRoll:
      return 'Saving...'
    case T.FS.DownloadIntent.Share:
      return 'Preparing...'
    default:
      return ''
  }
}

const StillContainer = (p: OwnProps) => {
  const {destinationPickerIndex, path} = p
  const {_downloads, _pathItem, _pathItemActionMenu, _uploads, dismissUpload} = useFSState(
    C.useShallow(s => ({
      _downloads: s.downloads,
      _pathItem: FS.getPathItem(s.pathItems, path),
      _pathItemActionMenu: s.pathItemActionMenu,
      _uploads: s.uploads,
      dismissUpload: s.dispatch.dismissUpload,
    }))
  )
  const writingToJournalUploadState = _uploads.writingToJournal.get(path)
  const onOpen = useOpen({destinationPickerIndex, path})

  const dismissUploadError = writingToJournalUploadState?.error
    ? () => dismissUpload(writingToJournalUploadState.uploadID)
    : undefined
  const intentIfDownloading = FS.getDownloadIntent(path, _downloads, _pathItemActionMenu)
  const isEmpty =
    _pathItem.type === T.FS.PathType.Folder &&
    _pathItem.progress === T.FS.ProgressType.Loaded &&
    !_pathItem.children.size
  const type = _pathItem.type
  const uploading = _uploads.syncingPaths.has(path)
  const writingToJournal = !!writingToJournalUploadState

  return (
    <StillCommon
      path={path}
      onOpen={onOpen}
      writingToJournal={writingToJournal}
      uploadErrored={!!dismissUploadError}
      content={
        <>
          <Filename path={path} type={FS.pathTypeToTextType(type)} style={rowStyles.rowText} />
          {isEmpty && (
            <Kb.Meta
              title="empty"
              backgroundColor={Kb.Styles.globalColors.greyDark}
              style={{marginLeft: Kb.Styles.globalMargins.tiny, marginTop: Kb.Styles.globalMargins.xxtiny}}
            />
          )}
        </>
      }
      status={
        dismissUploadError ? (
          <Kb.Text type="BodySmallError">
            Upload has failed.{' '}
            <Kb.Text
              type="BodySmallPrimaryLink"
              style={styles.redDark}
              onClick={e => {
                e.stopPropagation()
                dismissUploadError()
              }}
            >
              Dismiss
            </Kb.Text>
          </Kb.Text>
        ) : intentIfDownloading ? (
          <Kb.Text type="BodySmall">{getDownloadingText(intentIfDownloading)}</Kb.Text>
        ) : writingToJournal ? (
          <Kb.Meta title="Encrypting" backgroundColor={Kb.Styles.globalColors.blue} />
        ) : uploading ? (
          <Kb.Text type="BodySmall">Uploading ...</Kb.Text>
        ) : (
          type !== T.FS.PathType.Folder && <LastModifiedLine path={path} mode="row" />
        )
      }
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  redDark: {color: Kb.Styles.globalColors.redDark},
}))

export default StillContainer
