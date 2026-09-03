import * as C from '@/constants'
import * as FS from '@/constants/fs'
import * as Chat from '@/constants/chat'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import {
  cancelAttachmentUploads,
  uploadAttachments,
  uploadAttachmentsFromDragAndDrop,
} from './attachment-actions'
import {getConversationClientPrev, useConversationExplodingMode, useConversationMeta} from './data-hooks'
import {setInputIntent} from './input-intent-store'
import AttachmentTrim from './attachment-trim'
import {canEdit, canProcess, isEditNoop, isVideoPath, processPaths, type VideoEdit} from '@/util/media-process'

type OwnProps = {
  conversationIDKey?: T.Chat.ConversationIDKey
  pathAndOutboxIDs: Array<T.Chat.PathAndOutboxID>
  inputPrefillText?: string
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

// Display only: which preview to show. Processing eligibility is canProcess,
// which is deliberately a different set (heic previews as a file but is
// processed, gif previews as an image but is passed through untouched).
const imageFileNameRegex = /[^/]+\.(jpg|png|gif|jpeg|bmp)$/i
export const pathToAttachmentType = (path: string) => {
  if (imageFileNameRegex.test(path)) {
    return 'image'
  }
  if (isVideoPath(path)) {
    return 'video'
  }
  return 'file'
}

export const isKbfsPath = (path: string) => path.startsWith('/keybase/')

const ContainerInner = (ownProps: OwnProps) => {
  const styles = useStyles()
  const {titles: _titles, tlfName, pathAndOutboxIDs} = ownProps
  const noDragDrop = ownProps.noDragDrop ?? false
  const selectConversationWithReason = ownProps.selectConversationWithReason
  const navigateUp = C.Router2.navigateUp
  const conversationIDKey = ownProps.conversationIDKey ?? Chat.noConversationIDKey
  const metaTlfName = useConversationMeta(conversationIDKey).tlfname
  const explodingMode = useConversationExplodingMode(conversationIDKey)
  const clientPrev = getConversationClientPrev(conversationIDKey)
  const onCancel = () => {
    cancelAttachmentUploads(
      pathAndOutboxIDs.reduce((l: Array<T.RPCChat.OutboxID>, {outboxID}) => {
        if (outboxID) {
          l.push(outboxID)
        }
        return l
      }, [])
    )
    navigateUp()
  }
  const clearModals = C.Router2.clearModals

  // Trim range and audio choice per item, keyed by their index in
  // pathAndOutboxIDs (a prop, so we can't write back into it). Paths are never
  // rewritten: the edit is applied by the same export that compresses, at Send.
  const [edits, setEdits] = React.useState<{[index: number]: VideoEdit}>({})
  const [progress, setProgress] = React.useState<{done: number; total: number} | undefined>()
  const [error, setError] = React.useState<string | undefined>()
  // The modal's Cancel and swipe-to-dismiss stay live during a multi-second export,
  // so a dismissed screen must not go on to upload or navigate when it finishes.
  const unmountedRef = React.useRef(false)
  React.useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
    }
  }, [])
  // Send awaits this instead of racing it: a fast tap must not apply the
  // default policy when the user has chosen "Keep full size". A failed lookup
  // resolves to true so we never quietly upload originals either.
  const compressPrefRef = React.useRef<Promise<boolean> | undefined>(undefined)
  React.useEffect(() => {
    if (!isIOS) {
      return
    }
    compressPrefRef.current = (async () => {
      try {
        const pref = await T.RPCGen.incomingShareGetPreferenceRpcPromise()
        return pref.compressPreference !== T.RPCGen.IncomingShareCompressPreference.original
      } catch {
        return true
      }
    })()
  }, [])
  // progress only exists once the export starts, which is after the preference
  // resolves, so it can't gate a double tap on its own
  const submittingRef = React.useRef(false)

  // skipProcessing is the "Send anyway" path: the user has already been told the
  // export failed and wants the originals.
  const _onSubmit = (titles: Array<string>, skipProcessing = false) => {
    if (progress || submittingRef.current) {
      return
    }
    submittingRef.current = true
    setError(undefined)
    const upload = (paths: Array<T.Chat.PathAndOutboxID>) => {
      const uploadArgs = {
        clientPrev,
        conversationIDKey,
        ephemeralLifetime: explodingMode,
        paths,
        titles,
        tlfName: tlfName ?? metaTlfName,
      }
      if (tlfName || noDragDrop) {
        uploadAttachments(uploadArgs)
      } else {
        uploadAttachmentsFromDragAndDrop(uploadArgs)
      }
      clearModals()

      if (selectConversationWithReason) {
        if (ownProps.inputPrefillText !== undefined) {
          setInputIntent(conversationIDKey, {text: ownProps.inputPrefillText, type: 'injectText'})
        }
        C.Router2.navigateToThread(conversationIDKey, selectConversationWithReason)
      }
    }

    const effective = pathAndOutboxIDs.map(({path, outboxID, url}) => ({outboxID, path, url}))

    if (!isIOS || skipProcessing) {
      submittingRef.current = false
      upload(effective)
      return
    }

    const isUnmounted = () => unmountedRef.current
    const f = async () => {
      const compress = (await compressPrefRef.current) ?? true
      if (isUnmounted()) {
        return
      }
      // Only local media can be handed to the native processor: kbfs paths aren't
      // real files and non-media has nothing to compress. "Keep full size" is a raw
      // share, so with compression off only an explicit trim still needs the
      // exporter — the cut has to be applied somewhere.
      const eligible = effective.reduce(
        (l: Array<{edit?: VideoEdit; idx: number; path: string}>, {path}, idx) => {
          const edit = edits[idx]
          const needsProcessing = compress ? canProcess(path) || !isEditNoop(edit) : !isEditNoop(edit)
          if (!isKbfsPath(path) && needsProcessing) {
            l.push({edit, idx, path})
          }
          return l
        },
        []
      )

      if (eligible.length === 0) {
        submittingRef.current = false
        upload(effective)
        return
      }

      setProgress({done: 0, total: eligible.length})
      const processed = await processPaths(
        eligible.map(({path, edit}) => ({edit, path})),
        compress,
        (done, total) => {
          if (!unmountedRef.current) {
            setProgress({done, total})
          }
        }
      )
      if (unmountedRef.current) {
        return
      }
      setProgress(undefined)
      submittingRef.current = false
      // A failed export means the original bytes: an uncompressed upload, or
      // worse a clip the user asked to trim going out full length. Stop and say
      // so instead of sending something they didn't ask for.
      const failure = processed.find(p => p.error)
      if (failure) {
        setError(failure.error)
        return
      }
      const next = [...effective]
      eligible.forEach(({idx}, i) => {
        const cur = next[idx]
        if (cur) {
          next[idx] = {...cur, path: processed[i]?.path ?? cur.path}
        }
      })
      upload(next)
    }
    C.ignorePromise(f())
  }
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

  const onNext = (e?: React.BaseSyntheticEvent) => {
    e?.preventDefault()

    const {info} = pathAndInfos[index] ?? {}
    if (!info) return

    const nextIndex = index + 1

    // done
    if (nextIndex === pathAndInfos.length) {
      _onSubmit(titles)
    } else {
      // go to next
      setIndex(s => s + 1)
    }
  }

  const onSubmit = (e?: React.BaseSyntheticEvent) => {
    e?.preventDefault()
    _onSubmit(titles)
  }

  const onSendAnyway = () => {
    _onSubmit(titles, true)
  }

  const updateTitle = (title: string) => {
    setTitles([...titles.slice(0, index), title, ...titles.slice(index + 1)])
  }

  const inputRef = React.useRef<Kb.Input3Ref>(null)

  const {info, path} = pathAndInfos[index] ?? {}
  const [kbfsPreview, setKbfsPreview] = React.useState<
    {path: string; url: string | undefined} | undefined
  >()
  const kbfsPreviewURL = kbfsPreview && kbfsPreview.path === path ? kbfsPreview.url : undefined
  React.useEffect(() => {
    if (info?.type !== 'image' || info.url || !path || !isKbfsPath(path)) {
      return
    }
    let canceled = false
    const f = async () => {
      try {
        const fileContext = await T.RPCGen.SimpleFSSimpleFSGetGUIFileContextRpcPromise({
          path: FS.pathToRPCPath(T.FS.stringToPath(path)).kbfs,
        })
        if (!canceled) {
          setKbfsPreview({path, url: fileContext.url})
        }
      } catch {}
    }
    C.ignorePromise(f())
    return () => {
      canceled = true
    }
  }, [info?.type, info?.url, path])

  const titleHint = 'Add a caption...'
  if (!info) return null

  // kbfs paths aren't real files, so there's nothing to export from them.
  const showTrim = !!path && !isKbfsPath(path) && canEdit(path)

  let preview: React.ReactNode
  switch (info.type) {
    case 'image':
      preview = path ? (
        <Kb.ZoomableImage src={info.url ?? kbfsPreviewURL ?? path} style={styles.image} boxCacheKey="getTitlesImg" />
      ) : null
      break
    case 'video':
      // kbfs paths aren't real files, so nothing can be exported from them.
      preview = !path ? null : showTrim ? (
        <AttachmentTrim
          // remount per slot AND per clip: duration and handle positions are
          // per-video state, and the same path can appear at two indexes
          key={`${index}-${path}`}
          path={path}
          edit={edits[index]}
          onEdit={edit => {
            setEdits(s => ({...s, [index]: edit}))
          }}
        />
      ) : (
        <Kb.Video autoPlay={false} allowFile={true} muted={true} url={path} />
      )
      break
    default: {
      if (isIOS && path && Chat.isPathHEIC(path)) {
        preview = <Kb.ZoomableImage src={path} style={styles.image} boxCacheKey="getTitlesHeicImg" />
      } else {
        preview = (
          <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
            <Kb.ImageIcon type="icon-file-uploading-48" />
          </Kb.Box2>
        )
      }
    }
  }

  const isLast = index + 1 === pathAndInfos.length
  // Are we trying to upload multiple?
  const multiUpload = pathAndInfos.length > 1

  return (
    <>
      <Kb.ErrorBanner
        error={error}
        onClose={() => {
          setError(undefined)
        }}
      />
      <Kb.Box2 alignItems="center" direction="vertical" fullWidth={true} style={styles.container}>
        <Kb.ClickableBox direction="vertical" fullWidth={true} alignItems="center" style={styles.container2} onClick={() => inputRef.current?.blur()}>
          <Kb.BoxGrow style={styles.boxGrow}>{preview}</Kb.BoxGrow>
          {pathAndInfos.length > 0 && !isMobile && (
            <Kb.Box2 direction="vertical" style={styles.filename}>
              <Kb.Text type="BodySmallSemibold">Filename</Kb.Text>
              <Kb.Text type="BodySmall" center={true}>
                {info.filename} ({index + 1} of {pathAndInfos.length})
              </Kb.Text>
            </Kb.Box2>
          )}
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.inputContainer}>
            <Kb.Input3
              ref={inputRef}
              autoFocus={!isMobile}
              onClick={(e: React.BaseSyntheticEvent) => {
                e.stopPropagation()
              }}
              autoCorrect={true}
              disabled={!!progress}
              placeholder={titleHint}
              multiline={true}
              rowsMin={2}
              value={titles[index]}
              onEnterKeyDown={onNext}
              onChangeText={updateTitle}
              hideBorder={true}
              containerStyle={styles.inputBare}
              inputStyle={styles.input}
            />
          </Kb.Box2>
        </Kb.ClickableBox>
        {progress ? (
          <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center" style={styles.progress}>
            <Kb.ProgressIndicator />
            {/* done counts completed items; the label names the one in flight */}
            <Kb.Text type="BodySmall">{`Processing ${Math.min(progress.done + 1, progress.total)} of ${progress.total}...`}</Kb.Text>
          </Kb.Box2>
        ) : null}
        <Kb.ButtonBar fullWidth={true} small={true} style={styles.buttonContainer}>
          {!isMobile && <Kb.Button fullWidth={true} type="Dim" onClick={onCancel} label="Cancel" />}
          {isLast ? (
            <Kb.WaitingButton
              disabled={!!progress}
              fullWidth={!multiUpload}
              onClick={onSubmit}
              label="Send"
            />
          ) : (
            <Kb.Button disabled={!!progress} fullWidth={!multiUpload} onClick={onNext} label="Next" />
          )}
          {multiUpload ? (
            <Kb.WaitingButton disabled={!!progress} onClick={onSubmit} label="Send All" />
          ) : null}
          {/* Send retries the export; this is the way out when it keeps failing. */}
          {error ? (
            <Kb.Button
              disabled={!!progress}
              type="Dim"
              onClick={onSendAnyway}
              label="Send original"
            />
          ) : null}
        </Kb.ButtonBar>
      </Kb.Box2>
    </>
  )
}

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      boxGrow: {
        flexShrink: 1,
        marginBottom: isMobile ? Kb.Styles.globalMargins.small : 0,
        width: '100%',
      },
      buttonContainer: Kb.Styles.platformStyles({
        isElectron: {
          alignSelf: 'flex-end',
          borderStyle: 'solid',
          borderTopColor: theme.black_10,
          borderTopWidth: 1,
          flexShrink: 0,
          padding: Kb.Styles.globalMargins.small,
        },
        isMobile: Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small, 0),
      }),
      container: Kb.Styles.platformStyles({
        common: {
          flexGrow: 1,
          ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
          width: '100%',
        },
        isElectron: {paddingTop: Kb.Styles.globalMargins.small},
        isMobile: {flexShrink: 1},
      }),
      container2: Kb.Styles.platformStyles({
        common: {flexGrow: 1},
        isElectron: {height: '100%', overflow: 'hidden'},
        isMobile: {flexShrink: 1, flexGrow: 1},
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
      input: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.border(theme.blue, 1, Kb.Styles.borderRadius),
          maxHeight: 42,
          minHeight: 42,
          padding: Kb.Styles.globalMargins.tiny,
          width: '100%',
        },
        isTablet: {
          alignSelf: 'center',
          maxWidth: 460,
        },
      }),
      inputBare: {
        backgroundColor: theme.transparent,
        marginBottom: Kb.Styles.globalMargins.tiny,
        padding: 0,
        width: '100%',
      },
      inputContainer: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
        },
      }),
      progress: {
        alignSelf: 'center',
        paddingTop: Kb.Styles.globalMargins.tiny,
      },
    }) as const
)

export default ContainerInner
