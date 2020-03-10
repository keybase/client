import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Types from '../../../../../constants/types/chat2'
import * as Constants from '../../../../../constants/chat2'
import * as Styles from '../../../../../styles'
import {ShowToastAfterSaving} from '../shared'
import {useMemo} from '../../../../../util/memoize'

type Props = {
  arrowColor: string
  onDownload?: () => void
  onShowInFinder?: () => void
  title: string
  fileName: string
  message: Types.MessageAttachment
  progress: number
  transferState: Types.MessageAttachmentTransferState
  hasProgress: boolean
  errorMsg: string
}

const FileAttachment = React.memo((props: Props) => {
  const progressLabel = Constants.messageAttachmentTransferStateToProgressLabel(props.transferState)
  const iconType = 'icon-file-32'
  const {message} = props
  const wrappedMeta = useMemo(() => ({message}), [message])
  return (
    <>
      <ShowToastAfterSaving transferState={props.transferState} />
      <Kb.Box style={styles.containerStyle}>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" centerChildren={true}>
          <Kb.Icon type={iconType} style={styles.iconStyle} onClick={props.onDownload} />
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.titleStyle}>
            {props.fileName === props.title ? (
              // if the title is the filename, don't try to parse it as markdown
              <Kb.Text type="BodySemibold" onClick={props.onDownload}>
                {props.fileName}
              </Kb.Text>
            ) : (
              <Kb.Markdown meta={wrappedMeta} selectable={true}>
                {props.title}
              </Kb.Markdown>
            )}
            {props.fileName !== props.title && (
              <Kb.Text type="BodyTiny" onClick={props.onDownload}>
                {props.fileName}
              </Kb.Text>
            )}
          </Kb.Box2>
        </Kb.Box2>
        {!!props.arrowColor && (
          <Kb.Box style={styles.downloadedIconWrapperStyle}>
            <Kb.Icon type="iconfont-download" style={styles.downloadedIcon} color={props.arrowColor} />
          </Kb.Box>
        )}
        {!!progressLabel && (
          <Kb.Box style={styles.progressContainerStyle}>
            <Kb.Text type="BodySmall" style={styles.progressLabelStyle}>
              {progressLabel}
            </Kb.Text>
            {props.hasProgress && <Kb.ProgressBar ratio={props.progress} />}
          </Kb.Box>
        )}
        {!!props.errorMsg && (
          <Kb.Box style={styles.progressContainerStyle}>
            <Kb.Text type="BodySmall" style={styles.error}>
              Failed to download.{' '}
              <Kb.Text type="BodySmall" style={styles.retry} onClick={props.onDownload}>
                Retry
              </Kb.Text>
            </Kb.Text>
          </Kb.Box>
        )}
        {props.onShowInFinder && (
          <Kb.Text type="BodySmallPrimaryLink" onClick={props.onShowInFinder} style={styles.linkStyle}>
            Show in {Styles.fileUIName}
          </Kb.Text>
        )}
      </Kb.Box>
    </>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      containerStyle: {
        ...Styles.globalStyles.flexBoxColumn,
        width: '100%',
      },
      downloadedIcon: {
        maxHeight: 14,
        position: 'relative',
        top: 1,
      },
      downloadedIconWrapperStyle: {
        ...Styles.globalStyles.flexBoxCenter,
        backgroundColor: Styles.globalColors.white,
        borderRadius: 20,
        bottom: 0,
        padding: 3,
        position: 'absolute',
        right: 0,
      },
      error: {color: Styles.globalColors.redDark},
      iconStyle: {
        height: 32,
        width: 32,
      },
      linkStyle: {
        color: Styles.globalColors.black_50,
      },
      progressContainerStyle: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
      },
      progressLabelStyle: {
        color: Styles.globalColors.black_50,
        marginRight: Styles.globalMargins.tiny,
      },
      retry: {
        color: Styles.globalColors.redDark,
        textDecorationLine: 'underline',
      },
      titleStyle: {
        flex: 1,
      },
    } as const)
)

export default FileAttachment
