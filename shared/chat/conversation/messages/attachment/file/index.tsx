import captialize from 'lodash/capitalize'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import type * as T from '@/constants/types'
import {getEditStyle, ShowToastAfterSaving} from '../shared'
import * as CryptoConstants from '@/constants/crypto'

type Props = {
  showMessageMenu: () => void
  arrowColor: string
  onDownload?: () => void
  onShowInFinder?: () => void
  onShowPDF?: () => void
  title: string
  fileName: string
  progress: number
  transferState: T.Chat.MessageAttachmentTransferState
  hasProgress: boolean
  errorMsg: string
  isEditing: boolean
  isSaltpackFile: boolean
  onSaltpackFileOpen: (path: string, operation: T.Crypto.Operations) => void
}

const FileAttachment = React.memo(function FileAttachment(props: Props) {
  const progressLabel = C.Chat.messageAttachmentTransferStateToProgressLabel(props.transferState)
  const {isSaltpackFile, isEditing, showMessageMenu} = props
  const iconType = isSaltpackFile ? 'icon-file-saltpack-32' : 'icon-file-32'
  const operation = CryptoConstants.isPathSaltpackEncrypted(props.fileName)
    ? CryptoConstants.Operations.Decrypt
    : CryptoConstants.isPathSaltpackSigned(props.fileName)
      ? CryptoConstants.Operations.Verify
      : undefined
  const operationTitle = captialize(operation)

  return (
    <Kb.ClickableBox2 onLongPress={showMessageMenu} onClick={props.onDownload}>
      <ShowToastAfterSaving transferState={props.transferState} />
      <Kb.Box
        style={Kb.Styles.collapseStyles([styles.containerStyle, getEditStyle(isEditing), styles.filename])}
      >
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" centerChildren={true}>
          <Kb.Icon fixOverdraw={true} type={iconType} style={styles.iconStyle} />
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.titleStyle}>
            {props.fileName === props.title ? (
              // if the title is the filename, don't try to parse it as markdown
              <Kb.Text
                type="BodySemibold"
                style={Kb.Styles.collapseStyles([
                  isSaltpackFile && styles.saltpackFileName,
                  getEditStyle(isEditing),
                  styles.filename,
                ])}
              >
                {props.fileName}
              </Kb.Text>
            ) : (
              <Kb.Markdown
                messageType="attachment"
                selectable={true}
                style={getEditStyle(isEditing)}
                styleOverride={Kb.Styles.isMobile ? ({paragraph: getEditStyle(isEditing)} as any) : undefined}
                allowFontScaling={true}
              >
                {props.title}
              </Kb.Markdown>
            )}
            {props.fileName !== props.title && (
              <Kb.Text
                type="BodyTiny"
                onClick={props.onDownload}
                style={Kb.Styles.collapseStyles([
                  isSaltpackFile && styles.saltpackFileName,
                  getEditStyle(isEditing),
                ])}
              >
                {props.fileName}
              </Kb.Text>
            )}
          </Kb.Box2>
        </Kb.Box2>
        {!Kb.Styles.isMobile && isSaltpackFile && operation && (
          <Kb.Box style={styles.saltpackOperationContainer}>
            <Kb.Button
              mode="Secondary"
              small={true}
              label={operationTitle}
              style={styles.saltpackOperation}
              onClick={() => props.onSaltpackFileOpen(props.fileName, operation)}
            />
          </Kb.Box>
        )}
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
            Show in {Kb.Styles.fileUIName}
          </Kb.Text>
        )}
      </Kb.Box>
    </Kb.ClickableBox2>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      containerStyle: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxColumn,
          width: '100%',
        },
        isElectron: {...Kb.Styles.desktopStyles.clickable},
      }),
      downloadedIcon: {
        maxHeight: 14,
        position: 'relative',
        top: 1,
      },
      downloadedIconWrapperStyle: {
        ...Kb.Styles.globalStyles.flexBoxCenter,
        ...Kb.Styles.padding(3, 0, 3, 3),
        borderRadius: 20,
        bottom: 0,
        position: 'absolute',
        right: Kb.Styles.globalMargins.small,
      },
      error: {color: Kb.Styles.globalColors.redDark},
      filename: Kb.Styles.platformStyles({
        isElectron: {...Kb.Styles.desktopStyles.clickable},
      }),
      iconStyle: Kb.Styles.platformStyles({
        common: {
          height: 32,
          width: 32,
        },
        isElectron: {
          display: 'block',
          height: 35,
          ...Kb.Styles.desktopStyles.clickable,
        },
      }),
      linkStyle: {color: Kb.Styles.globalColors.black_50},
      progressContainerStyle: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
      },
      progressLabelStyle: {
        color: Kb.Styles.globalColors.black_50,
        marginRight: Kb.Styles.globalMargins.tiny,
      },
      retry: {
        color: Kb.Styles.globalColors.redDark,
        textDecorationLine: 'underline',
      },
      saltpackFileName: {
        color: Kb.Styles.globalColors.greenDark,
      },
      saltpackOperation: Kb.Styles.platformStyles({
        isTablet: {alignSelf: 'flex-start'},
      }),
      saltpackOperationContainer: {
        alignItems: 'flex-start',
        marginTop: Kb.Styles.globalMargins.xtiny,
      },
      titleStyle: {flex: 1},
    }) as const
)

export default FileAttachment
