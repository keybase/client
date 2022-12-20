import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import * as Styles from '../../../styles'
import {rowStyles, StillCommon, type StillCommonProps} from './common'
import * as Kb from '../../../common-adapters'
import {LastModifiedLine, Filename} from '../../common'

type StillProps = StillCommonProps & {
  dismissUploadError?: () => void
  intentIfDownloading?: Types.DownloadIntent | null
  isEmpty: boolean
  type: Types.PathType
  uploading: boolean
  writingToJournal: boolean
}

const getDownloadingText = (intent: Types.DownloadIntent) => {
  switch (intent) {
    case Types.DownloadIntent.None:
      return 'Downloading...'
    case Types.DownloadIntent.CameraRoll:
      return 'Saving...'
    case Types.DownloadIntent.Share:
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
        <Filename
          path={props.path}
          type={Constants.pathTypeToTextType(props.type)}
          style={rowStyles.rowText}
        />
        {props.isEmpty && (
          <Kb.Meta
            title="empty"
            backgroundColor={Styles.globalColors.greyDark}
            style={{marginLeft: Styles.globalMargins.tiny, marginTop: Styles.globalMargins.xxtiny}}
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
        <Kb.Meta title="Encrypting" backgroundColor={Styles.globalColors.blue} />
      ) : props.uploading ? (
        <Kb.Text type="BodySmall">Uploading ...</Kb.Text>
      ) : (
        props.type !== Types.PathType.Folder && <LastModifiedLine path={props.path} mode="row" />
      )
    }
  />
)

export default Still

const styles = Styles.styleSheetCreate(() => ({
  redDark: {color: Styles.globalColors.redDark},
}))
