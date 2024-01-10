import * as T from '@/constants/types'
import * as C from '@/constants'
import {rowStyles, StillCommon, type StillCommonProps} from './common'
import * as Kb from '@/common-adapters'
import {LastModifiedLine, Filename} from '@/fs/common'

type StillProps = StillCommonProps & {
  dismissUploadError?: () => void
  intentIfDownloading?: T.FS.DownloadIntent
  isEmpty: boolean
  type: T.FS.PathType
  uploading: boolean
  writingToJournal: boolean
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

const Still = (props: StillProps) => (
  <StillCommon
    path={props.path}
    onOpen={props.onOpen}
    inDestinationPicker={props.inDestinationPicker}
    writingToJournal={props.writingToJournal}
    uploadErrored={!!props.dismissUploadError}
    content={
      <>
        <Filename path={props.path} type={C.FS.pathTypeToTextType(props.type)} style={rowStyles.rowText} />
        {props.isEmpty && (
          <Kb.Meta
            title="empty"
            backgroundColor={Kb.Styles.globalColors.greyDark}
            style={{marginLeft: Kb.Styles.globalMargins.tiny, marginTop: Kb.Styles.globalMargins.xxtiny}}
          />
        )}
      </>
    }
    status={
      props.dismissUploadError ? (
        <Kb.Text type="BodySmallError">
          Upload has failed.{' '}
          <Kb.Text
            type="BodySmallPrimaryLink"
            style={styles.redDark}
            onClick={e => {
              e.stopPropagation()
              props.dismissUploadError?.()
            }}
          >
            Dismiss
          </Kb.Text>
        </Kb.Text>
      ) : props.intentIfDownloading ? (
        <Kb.Text type="BodySmall">{getDownloadingText(props.intentIfDownloading)}</Kb.Text>
      ) : props.writingToJournal ? (
        <Kb.Meta title="Encrypting" backgroundColor={Kb.Styles.globalColors.blue} />
      ) : props.uploading ? (
        <Kb.Text type="BodySmall">Uploading ...</Kb.Text>
      ) : (
        props.type !== T.FS.PathType.Folder && <LastModifiedLine path={props.path} mode="row" />
      )
    }
  />
)

export default Still

const styles = Kb.Styles.styleSheetCreate(() => ({
  redDark: {color: Kb.Styles.globalColors.redDark},
}))
