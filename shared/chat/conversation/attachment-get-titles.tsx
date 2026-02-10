import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'

type OwnProps = {
  pathAndOutboxIDs: Array<T.Chat.PathAndOutboxID>
  titles?: Array<string>
  selectConversationWithReason?: 'extension' | 'files'
  // If tlfName is set, we'll use Chat2Gen.createAttachmentsUpload. Otherwise
  // Chat2Gen.createAttachFromDragAndDrop is used.
  tlfName?: string
  // don't use the drag drop functionality, just upload the outbox IDs
  noDragDrop?: boolean
}

type Info = {
  type: 'image' | 'file' | 'video'
  title: string
  filename: string
  outboxID?: T.RPCChat.OutboxID
  url?: string
}

const imageFileNameRegex = /[^/]+\.(jpg|png|gif|jpeg|bmp)$/i
const videoFileNameRegex = /[^/]+\.(mp4|mov|avi|mkv)$/i
const pathToAttachmentType = (path: string) => {
  if (imageFileNameRegex.test(path)) {
    return 'image'
  }
  if (videoFileNameRegex.test(path)) {
    return 'video'
  }
  return 'file'
}

const Container = (ownProps: OwnProps) => {
  const {titles: _titles, tlfName, pathAndOutboxIDs} = ownProps
  const noDragDrop = ownProps.noDragDrop ?? false
  const selectConversationWithReason = ownProps.selectConversationWithReason
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const navigateToThread = Chat.useChatContext(s => s.dispatch.navigateToThread)
  const attachmentUploadCanceled = Chat.useChatContext(s => s.dispatch.attachmentUploadCanceled)
  const onCancel = () => {
    attachmentUploadCanceled(
      pathAndOutboxIDs.reduce((l: Array<T.RPCChat.OutboxID>, {outboxID}) => {
        if (outboxID) {
          l.push(outboxID)
        }
        return l
      }, [])
    )
    navigateUp()
  }
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const attachmentsUpload = Chat.useChatContext(s => s.dispatch.attachmentsUpload)
  const attachFromDragAndDrop = Chat.useChatContext(s => s.dispatch.attachFromDragAndDrop)

  const _onSubmit = React.useCallback(
    (titles: Array<string>, spoiler: boolean) => {
      tlfName || noDragDrop
        ? attachmentsUpload(pathAndOutboxIDs, titles, tlfName, spoiler)
        : attachFromDragAndDrop(pathAndOutboxIDs, titles)
      clearModals()

      if (selectConversationWithReason) {
        navigateToThread(selectConversationWithReason)
      }
    },
    [
      attachFromDragAndDrop,
      attachmentsUpload,
      clearModals,
      navigateToThread,
      noDragDrop,
      pathAndOutboxIDs,
      selectConversationWithReason,
      tlfName,
    ]
  )
  const pathAndInfos = pathAndOutboxIDs.map(({path, outboxID, url}) => {
    const filename = T.FS.getLocalPathName(path)
    const info: Info = {
      filename,
      outboxID: outboxID,
      title: '',
      type: pathToAttachmentType(path),
      url,
    }
    return {info, path}
  })

  const [index, setIndex] = React.useState(0)
  const [titles, setTitles] = React.useState(pathAndInfos.map((_, idx) => _titles?.[idx] ?? ''))
  const [spoiler, setSpoiler] = React.useState(false)
  setSpoiler // TODO commented out

  const onNext = React.useCallback(
    (e?: React.BaseSyntheticEvent) => {
      e?.preventDefault()

      const {info} = pathAndInfos[index] ?? {}
      if (!info) return

      const nextIndex = index + 1

      // done
      if (nextIndex === pathAndInfos.length) {
        _onSubmit(titles, spoiler)
      } else {
        // go to next
        setIndex(s => s + 1)
      }
    },
    [index, pathAndInfos, titles, spoiler, setIndex, _onSubmit]
  )

  const onSubmit = React.useCallback(
    (e?: React.BaseSyntheticEvent) => {
      e?.preventDefault()
      _onSubmit(titles, spoiler)
    },
    [_onSubmit, titles, spoiler]
  )

  const updateTitle = React.useCallback(
    (title: string) => {
      setTitles([...titles.slice(0, index), title, ...titles.slice(index + 1)])
    },
    [index, titles]
  )

  const inputRef = React.useRef<Kb.PlainInputRef>(null)

  const {info, path} = pathAndInfos[index] ?? {}
  const titleHint = 'Add a caption...'
  if (!info) return null

  let preview: React.ReactNode
  switch (info.type) {
    case 'image':
      preview = path ? (
        <Kb.ZoomableImage src={info.url ?? path} style={styles.image} boxCacheKey="getTitlesImg" />
      ) : null
      break
    case 'video':
      preview = path ? <Kb.Video autoPlay={false} allowFile={true} muted={true} url={path} /> : null
      break
    default: {
      if (C.isIOS && path && Chat.isPathHEIC(path)) {
        preview = <Kb.ZoomableImage src={path} style={styles.image} boxCacheKey="getTitlesHeicImg" />
      } else {
        preview = (
          <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
            <Kb.Icon type="icon-file-uploading-48" />
          </Kb.Box2>
        )
      }
    }
  }

  const isLast = index + 1 === pathAndInfos.length
  // Are we trying to upload multiple?
  const multiUpload = pathAndInfos.length > 1

  return (
    <Kb.PopupWrapper onCancel={onCancel}>
      <Kb.Box2 alignItems="center" direction="vertical" fullWidth={true} style={styles.container}>
        <Kb.ClickableBox2 style={styles.container2} onClick={() => inputRef.current?.blur()}>
          <Kb.Box2 direction="vertical" style={styles.containerOuter} fullWidth={true}>
            <Kb.BoxGrow style={styles.boxGrow}>{preview}</Kb.BoxGrow>
            {pathAndInfos.length > 0 && !Kb.Styles.isMobile && (
              <Kb.Box2 direction="vertical" style={styles.filename}>
                <Kb.Text type="BodySmallSemibold">Filename</Kb.Text>
                <Kb.Text type="BodySmall" center={true}>
                  {info.filename} ({index + 1} of {pathAndInfos.length})
                </Kb.Text>
              </Kb.Box2>
            )}
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inputContainer}>
              <Kb.PlainInput
                ref={inputRef}
                style={styles.input}
                autoFocus={!Kb.Styles.isMobile}
                onClick={e => {
                  e.stopPropagation()
                }}
                autoCorrect={true}
                placeholder={titleHint}
                multiline={true}
                rowsMin={2}
                padding="tiny"
                value={titles[index]}
                onEnterKeyDown={onNext}
                onChangeText={updateTitle}
              />
              {/* (
                <Kb.Checkbox
                  style={{alignSelf: 'flex-end'}}
                  label="Spoiler?"
                  checked={spoiler}
                  onCheck={setSpoiler}
                />
              )*/}
            </Kb.Box2>
          </Kb.Box2>
        </Kb.ClickableBox2>
        <Kb.ButtonBar fullWidth={true} small={true} style={styles.buttonContainer}>
          {!Kb.Styles.isMobile && <Kb.Button fullWidth={true} type="Dim" onClick={onCancel} label="Cancel" />}
          {isLast ? (
            <Kb.WaitingButton fullWidth={!multiUpload} onClick={onSubmit} label="Send" />
          ) : (
            <Kb.Button fullWidth={!multiUpload} onClick={onNext} label="Next" />
          )}
          {multiUpload ? <Kb.WaitingButton onClick={onSubmit} label="Send All" /> : null}
        </Kb.ButtonBar>
      </Kb.Box2>
    </Kb.PopupWrapper>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      boxGrow: {
        flexShrink: 1,
        marginBottom: Kb.Styles.isMobile ? Kb.Styles.globalMargins.small : 0,
        width: '100%',
      },
      buttonContainer: Kb.Styles.platformStyles({
        isElectron: {
          alignSelf: 'flex-end',
          borderStyle: 'solid',
          borderTopColor: Kb.Styles.globalColors.black_10,
          borderTopWidth: 1,
          flexShrink: 0,
          padding: Kb.Styles.globalMargins.small,
        },
        isMobile: Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small, 0),
      }),
      cancelButton: {marginRight: Kb.Styles.globalMargins.tiny},
      container: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          flexGrow: 1,
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
          width: '100%',
        },
        isMobile: {flexShrink: 1},
      }),
      container2: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          flexGrow: 1,
          width: '100%',
        },
        isMobile: {flexShrink: 1},
      }),
      containerOuter: Kb.Styles.platformStyles({
        isElectron: {
          height: 560,
          width: 400,
        },
        isMobile: {flexGrow: 1, flexShrink: 1},
      }),
      filename: Kb.Styles.platformStyles({
        isElectron: {
          alignItems: 'center',
          marginBottom: Kb.Styles.globalMargins.small,
        },
      }),
      image: {
        height: '100%',
        maxHeight: '100%',
        maxWidth: '100%',
        width: '100%',
      },
      imageContainer: Kb.Styles.platformStyles({
        common: {justifyContent: 'center'},
        isElectron: {
          flex: 1,
          height: 325,
          paddingBottom: Kb.Styles.globalMargins.medium,
          paddingTop: Kb.Styles.globalMargins.medium,
          width: 325,
        },
        isMobile: {
          height: '100%',
          width: '100%',
        },
      }),
      input: Kb.Styles.platformStyles({
        common: {
          borderColor: Kb.Styles.globalColors.blue,
          borderRadius: Kb.Styles.borderRadius,
          borderWidth: 1,
          marginBottom: Kb.Styles.globalMargins.tiny,
          maxHeight: 42,
          minHeight: 42,
          width: '100%',
        },
        isTablet: {
          alignSelf: 'center',
          maxWidth: 460,
        },
      }),
      inputContainer: Kb.Styles.platformStyles({
        isElectron: {
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
        },
      }),
      nonImage: {
        alignSelf: 'center',
        justifyContentSelf: 'center',
      },
      scrollView: Kb.Styles.platformStyles({
        common: {
          backgroundColor: Kb.Styles.globalColors.blueGrey,
          height: '100%',
          width: '100%',
        },
        isElectron: {borderRadius: Kb.Styles.borderRadius},
      }),
    }) as const
)
export default Container
