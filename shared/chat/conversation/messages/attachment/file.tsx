import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Crypto from '@/stores/crypto'
import * as React from 'react'
import {isPathSaltpack, isPathSaltpackEncrypted, isPathSaltpackSigned} from '@/util/path'
import type * as T from '@/constants/types'
import {useOrdinal} from '@/chat/conversation/messages/ids-context'
import captialize from 'lodash/capitalize'
import * as Kb from '@/common-adapters'
import type {StyleOverride} from '@/common-adapters/markdown'
import {getEditStyle, ShowToastAfterSaving} from './shared'
import {useFSState} from '@/stores/fs'

type OwnProps = {showPopup: () => void}

const missingMessage = Chat.makeMessageAttachment({})

const FileContainer = React.memo(function FileContainer(p: OwnProps) {
  const ordinal = useOrdinal()
  const data = Chat.useChatContext(
    C.useShallow(s => {
      const m = s.messageMap.get(ordinal) ?? missingMessage
      const isEditing = !!s.editing
      const conversationIDKey = s.id
      const {downloadPath, fileName, fileType, transferErrMsg, transferState} = m
      const title = m.decoratedText?.stringValue() || m.title || m.fileName
      const progress = m.type === 'attachment' ? m.transferProgress : 0

      const {dispatch} = s
      const {attachmentDownload, messageAttachmentNativeShare} = dispatch
      return {
        attachmentDownload,
        conversationIDKey,
        downloadPath,
        fileName,
        fileType,
        isEditing,
        messageAttachmentNativeShare,
        progress,
        title,
        transferErrMsg,
        transferState,
      }
    })
  )

  const {conversationIDKey, fileType, downloadPath, isEditing, progress, messageAttachmentNativeShare} = data
  const {attachmentDownload, title, transferState, transferErrMsg, fileName: _fileName} = data

  const saltpackOpenFile = Crypto.useCryptoState(s => s.dispatch.onSaltpackOpenFile)
  const switchTab = C.useRouterState(s => s.dispatch.switchTab)
  const onSaltpackFileOpen = React.useCallback(
    (path: string, operation: T.Crypto.Operations) => {
      switchTab(C.Tabs.cryptoTab)
      saltpackOpenFile(operation, path)
    },
    [switchTab, saltpackOpenFile]
  )
  const openLocalPathInSystemFileManagerDesktop = useFSState(
    s => s.dispatch.defer.openLocalPathInSystemFileManagerDesktop
  )
  const _onShowInFinder = React.useCallback(() => {
    downloadPath && openLocalPathInSystemFileManagerDesktop?.(downloadPath)
  }, [openLocalPathInSystemFileManagerDesktop, downloadPath])

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onDownload = React.useCallback(() => {
    if (C.isMobile) {
      messageAttachmentNativeShare(ordinal, true)
    } else if (!downloadPath) {
      if (fileType === 'application/pdf') {
        navigateAppend({
          props: {conversationIDKey, ordinal},
          selected: 'chatPDF',
        })
      } else {
        switch (transferState) {
          case 'uploading':
          case 'downloading':
          case 'mobileSaving':
            return
          default:
        }
        attachmentDownload(ordinal)
      }
    }
  }, [
    ordinal,
    conversationIDKey,
    navigateAppend,
    attachmentDownload,
    messageAttachmentNativeShare,
    downloadPath,
    transferState,
    fileType,
  ])

  const arrowColor = C.isMobile
    ? ''
    : downloadPath
      ? Kb.Styles.globalColors.green
      : transferState === 'downloading'
        ? Kb.Styles.globalColors.blue
        : ''
  const hasProgress =
    !!transferState && transferState !== 'remoteUploading' && transferState !== 'mobileSaving'

  const errorMsg = transferErrMsg || ''
  const fileName = _fileName ?? ''
  const isSaltpackFile = !!fileName && isPathSaltpack(fileName)
  const onShowInFinder = !C.isMobile && downloadPath ? _onShowInFinder : undefined
  const showMessageMenu = p.showPopup

  const progressLabel = Chat.messageAttachmentTransferStateToProgressLabel(transferState)
  const iconType = isSaltpackFile ? 'icon-file-saltpack-32' : 'icon-file-32'
  const operation = isPathSaltpackEncrypted(fileName)
    ? Crypto.Operations.Decrypt
    : isPathSaltpackSigned(fileName)
      ? Crypto.Operations.Verify
      : undefined
  const operationTitle = captialize(operation)

  const styleOverride = Kb.Styles.isMobile
    ? ({paragraph: getEditStyle(isEditing)} as StyleOverride)
    : undefined

  return (
    <Kb.ClickableBox2 onLongPress={showMessageMenu} onClick={onDownload}>
      <ShowToastAfterSaving transferState={transferState} />
      <Kb.Box
        style={Kb.Styles.collapseStyles([styles.containerStyle, getEditStyle(isEditing), styles.filename])}
      >
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" centerChildren={true}>
          <Kb.Icon fixOverdraw={true} type={iconType} style={styles.iconStyle} />
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.titleStyle}>
            {fileName === title ? (
              // if the title is the filename, don't try to parse it as markdown
              <Kb.Text
                type="BodySemibold"
                style={Kb.Styles.collapseStyles([
                  isSaltpackFile && styles.saltpackFileName,
                  getEditStyle(isEditing),
                  styles.filename,
                ])}
              >
                {fileName}
              </Kb.Text>
            ) : (
              <Kb.Markdown
                messageType="attachment"
                selectable={true}
                style={getEditStyle(isEditing)}
                styleOverride={styleOverride}
                allowFontScaling={true}
              >
                {title}
              </Kb.Markdown>
            )}
            {fileName !== title && (
              <Kb.Text
                type="BodyTiny"
                onClick={onDownload}
                style={Kb.Styles.collapseStyles([
                  isSaltpackFile && styles.saltpackFileName,
                  getEditStyle(isEditing),
                ])}
              >
                {fileName}
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
              onClick={() => onSaltpackFileOpen(fileName, operation)}
            />
          </Kb.Box>
        )}
        {!!arrowColor && (
          <Kb.Box style={styles.downloadedIconWrapperStyle}>
            <Kb.Icon type="iconfont-download" style={styles.downloadedIcon} color={arrowColor} />
          </Kb.Box>
        )}
        {!!progressLabel && (
          <Kb.Box style={styles.progressContainerStyle}>
            <Kb.Text type="BodySmall" style={styles.progressLabelStyle}>
              {progressLabel}
            </Kb.Text>
            {hasProgress && <Kb.ProgressBar ratio={progress} />}
          </Kb.Box>
        )}
        {!!errorMsg && (
          <Kb.Box style={styles.progressContainerStyle}>
            <Kb.Text type="BodySmall" style={styles.error}>
              Failed to download.{' '}
              <Kb.Text type="BodySmall" style={styles.retry} onClick={onDownload}>
                Retry
              </Kb.Text>
            </Kb.Text>
          </Kb.Box>
        )}
        {onShowInFinder && (
          <Kb.Text type="BodySmallPrimaryLink" onClick={onShowInFinder} style={styles.linkStyle}>
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
      filename: Kb.Styles.platformStyles({isElectron: {...Kb.Styles.desktopStyles.clickable}}),
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
      saltpackFileName: {color: Kb.Styles.globalColors.greenDark},
      saltpackOperation: Kb.Styles.platformStyles({isTablet: {alignSelf: 'flex-start'}}),
      saltpackOperationContainer: {
        alignItems: 'flex-start',
        marginTop: Kb.Styles.globalMargins.xtiny,
      },
      titleStyle: {flex: 1},
    }) as const
)

export default FileContainer
