import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Types from '../../../../../constants/types/chat2'
import * as Constants from '../../../../../constants/chat2'
import * as Styles from '../../../../../styles'
import {ShowToastAfterSaving} from '../shared'

type Props = {
  arrowColor: string
  onDownload?: () => void
  onShowInFinder?: () => void
  title: string
  fileName: string
  progress: number
  transferState: Types.MessageAttachmentTransferState
  hasProgress: boolean
  errorMsg: string
}

const FileAttachment = React.memo((props: Props) => {
  const progressLabel = Constants.messageAttachmentTransferStateToProgressLabel(props.transferState)
  const iconType = 'icon-file-32'
  return (
    <>
      <ShowToastAfterSaving transferState={props.transferState} />
      <Kb.ClickableBox onClick={props.onDownload} style={styles.fullWidth}>
        <Kb.Box style={styles.containerStyle}>
          <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" centerChildren={true}>
            <Kb.Icon type={iconType} style={styles.iconStyle} />
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.titleStyle}>
              <Kb.Text type="BodySemibold">{props.title}</Kb.Text>
              {props.fileName !== props.title && <Kb.Text type="BodyTiny">{props.fileName}</Kb.Text>}
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
                Failed to download attachment, please retry
              </Kb.Text>
            </Kb.Box>
          )}
          {props.onShowInFinder && (
            <Kb.Text type="BodySmallPrimaryLink" onClick={props.onShowInFinder} style={styles.linkStyle}>
              Show in {Styles.fileUIName}
            </Kb.Text>
          )}
        </Kb.Box>
      </Kb.ClickableBox>
    </>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      containerStyle: {
        ...Styles.globalStyles.flexBoxColumn,
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
      fullWidth: {width: '100%'},
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
      titleStyle: {
        flex: 1,
      },
    } as const)
)

export default FileAttachment
