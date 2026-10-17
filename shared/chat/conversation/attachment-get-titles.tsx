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
import {getConversationClientPrev} from './client-prev'
import {getAccountGeneration} from '@/engine/account-generation'
import {useConversationExplodingMode, useConversationMeta} from './data-hooks'
import AttachmentTrim from './attachment-trim'
import logger from '@/logger'
import {isKbfsPath} from './attachment-path'
import {setInputIntent} from './input-intent-store'
import {useNavigation} from '@react-navigation/native'
import {
  canCompressPickedFile,
  canEdit,
  canProcess,
  deleteConsumedSources,
  discardProcessedOutputs,
  isEditNoop,
  isProcessableImagePath,
  isVideoPath,
  processingErrorMessage,
  processPaths,
  type ProcessResult,
  type VideoEdit,
} from '@/util/media-process'

type OwnProps = {
  conversationIDKey?: T.Chat.ConversationIDKey
  pathAndOutboxIDs: Array<T.Chat.PathAndOutboxID>
  inputPrefillText?: string
  // Shown above the preview, e.g. that some shared items didn't make it
  notice?: string
  titles?: Array<string>
  selectConversationWithReason?: 'extension' | 'files'
  // If tlfName is set, we'll use Chat2Gen.createAttachmentsUpload. Otherwise
  // Chat2Gen.createAttachFromDragAndDrop is used.
  tlfName?: string
  // don't use the drag drop functionality, just upload the outbox IDs
  noDragDrop?: boolean
  // Chosen in the file picker: sent as files, so only the images the app always
  // compressed are re-encoded, and nothing is converted to another format.
  pickedAsFiles?: boolean
  // Shared text one of these files carries, put back after the conversation's draft if the files
  // are never handed to upload, so it is not lost with a cancel
  textBack?: string
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

// Why Send original couldn't send an image, after its name.
const droppedReason = (r?: ProcessResult) => {
  if (r?.error === undefined) {
    return "couldn't be prepared."
  }
  switch (r.errorCode) {
    case 'media_missing':
      return 'is no longer on this device.'
    case 'media_unrecognized':
      return "is in a format this device can't read, and the original can include its location."
    case undefined:
      return "couldn't be converted to a JPEG, and the original can include its location."
  }
}

// A throw is reported like a per-item failure, so Send always comes back to a
// state the user can act on.
const processForSend = async (
  ...args: Parameters<typeof processPaths>
): Promise<{processed: Array<ProcessResult>; failure?: string}> => {
  try {
    const processed = await processPaths(...args)
    return {failure: processed.find(p => p.error)?.error, processed}
  } catch (e) {
    logger.warn('attachment titles: processing threw', e)
    return {failure: processingErrorMessage(e), processed: []}
  }
}

const ContainerInner = (ownProps: OwnProps) => {
  const styles = useStyles()
  const {inputPrefillText, notice, pickedAsFiles, textBack, titles: _titles, tlfName, pathAndOutboxIDs} =
    ownProps
  const noDragDrop = ownProps.noDragDrop ?? false
  const selectConversationWithReason = ownProps.selectConversationWithReason
  const navigateUp = C.Router2.navigateUp
  const conversationIDKey = ownProps.conversationIDKey ?? Chat.noConversationIDKey
  const meta = useConversationMeta(conversationIDKey)
  const metaTlfName = meta.tlfname
  const metaFailed = meta.trustedState === 'error'
  // A share to a suggested conversation can arrive before the inbox meta has loaded; the meta hook
  // above triggers that load, and Send waits for it.
  const resolvedTlfName = tlfName || metaTlfName || undefined
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
  // Send original couldn't send any of the items, so offering it again is pointless.
  const [originalsBlocked, setOriginalsBlocked] = React.useState(false)
  // The modal's Cancel and swipe-to-dismiss stay live during a multi-second export,
  // so a dismissed screen must not go on to upload or navigate when it finishes.
  const unmountedRef = React.useRef(false)
  // The screen belongs to the account it opened for. A switch can leave it mounted for a moment,
  // and an export can outlast one; either way it sends nothing for the next account.
  const generationRef = React.useRef(0)
  React.useEffect(() => {
    unmountedRef.current = false
    generationRef.current = getAccountGeneration()
    return () => {
      unmountedRef.current = true
    }
  }, [])
  const accountChanged = () => getAccountGeneration() !== generationRef.current
  const handedOffRef = React.useRef(false)
  // On the screen's removal, not an effect cleanup: a screen hidden under two others, or StrictMode,
  // tears effects down while it stays. Once, and not after a hand-off or for an account gone.
  const navigation = useNavigation()
  const putBackRef = React.useRef(false)
  React.useEffect(() => {
    if (textBack === undefined) return
    return navigation.addListener('beforeRemove', () => {
      if (handedOffRef.current || putBackRef.current || getAccountGeneration() !== generationRef.current) {
        return
      }
      putBackRef.current = true
      setInputIntent(conversationIDKey, {putBack: true, text: textBack, type: 'injectText'})
    })
  }, [navigation, conversationIDKey, textBack])
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
  // resolves, so it can't gate a double tap on its own. The ref guards a second
  // tap in the same frame; the state drives Send's spinner. Both stay set once an
  // upload starts, since the screen is on its way out and a second tap would send
  // again; they're cleared only where the screen stays up for the user to retry.
  const submittingRef = React.useRef(false)
  const [submitting, setSubmitting] = React.useState(false)
  const endSubmit = () => {
    submittingRef.current = false
    setSubmitting(false)
  }

  // skipProcessing is the "Send original" path: the user has already been told the
  // export failed and wants the originals.
  const _onSubmit = (titles: Array<string>, skipProcessing = false) => {
    if (progress || submittingRef.current || !resolvedTlfName) {
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    setError(undefined)
    // Says whether the paths were handed off, so the caller knows whether the
    // export's sources are spent.
    // dropped is shown in the thread's status bar once the screen is gone.
    const upload = (
      paths: Array<T.Chat.PathAndOutboxID>,
      uploadTitles: ReadonlyArray<string> = titles,
      dropped?: string
    ) => {
      if (accountChanged()) {
        logger.info('attachment titles: account changed, sending nothing')
        endSubmit()
        return false
      }
      handedOffRef.current = true
      const uploadArgs = {
        clientPrev,
        conversationIDKey,
        ephemeralLifetime: explodingMode,
        paths,
        titles: uploadTitles,
        tlfName: resolvedTlfName,
      }
      if (tlfName || noDragDrop) {
        uploadAttachments(uploadArgs)
      } else {
        uploadAttachmentsFromDragAndDrop(uploadArgs)
      }
      clearModals()

      if (selectConversationWithReason) {
        C.Router2.navigateToThread(conversationIDKey, selectConversationWithReason, {
          intent:
            inputPrefillText === undefined && !dropped
              ? undefined
              : {append: true, notice: dropped, text: inputPrefillText, type: 'injectText'},
        })
      } else if (dropped) {
        // The thread is under this modal, so its composer takes this right away.
        setInputIntent(conversationIDKey, {notice: dropped, type: 'injectText'})
      }
      return true
    }

    const effective = pathAndOutboxIDs.map(({path, outboxID, url}) => ({outboxID, path, url}))

    if (!isIOS) {
      upload(effective)
      return
    }

    // Send original sends what "Keep full size" would: a format recipients can't
    // show (webp, avif, tiff, RAW) becomes a metadata-free JPEG, and the rest come
    // back as the source. After a compressed run that source must carry no
    // location (stripLocation): native strips it, or converts it to a JPEG, or
    // fails it. With Keep full size it is the raw original, metadata and all. One
    // that can't be cleaned is dropped rather than sent with its location, and the
    // rest still go. Files chosen in the file picker go as they are.
    const sendOriginals = async () => {
      if (accountChanged()) {
        endSubmit()
        return
      }
      const eligible = pickedAsFiles
        ? []
        : effective.reduce((l: Array<{idx: number; path: string}>, {path}, idx) => {
            if (!isKbfsPath(path) && isProcessableImagePath(path)) {
              l.push({idx, path})
            }
            return l
          }, [])
      if (eligible.length === 0) {
        upload(effective)
        return
      }
      setProgress({done: 0, total: eligible.length})
      const items = eligible.map(({path}) => ({path}))
      // The failed run that led here used the same preference.
      const stripLocation = (await compressPrefRef.current) ?? true
      const {processed} = await processForSend(
        items,
        {compress: false, stripLocation},
        (done, total) => {
          if (!unmountedRef.current) {
            setProgress({done, total})
          }
        }
      )
      if (unmountedRef.current) {
        discardProcessedOutputs(items, processed)
        return
      }
      setProgress(undefined)
      const next: Array<T.Chat.PathAndOutboxID | undefined> = [...effective]
      const droppedLines: Array<string> = []
      eligible.forEach(({idx, path}, i) => {
        const r = processed[i]
        if (r && r.error === undefined) {
          const cur = next[idx]
          next[idx] = cur && {...cur, path: r.path}
        } else {
          next[idx] = undefined
          droppedLines.push(`${T.FS.getLocalPathName(path)} ${droppedReason(r)}`)
        }
      })
      if (droppedLines.length === 0) {
        if (upload(effective.map((e, idx) => next[idx] ?? e))) {
          deleteConsumedSources(items, processed)
        } else {
          discardProcessedOutputs(items, processed)
        }
        return
      }
      const keptIdx = effective.flatMap((_, idx) => (next[idx] ? [idx] : []))
      // Every image failed, so there are no outputs to discard.
      if (keptIdx.length === 0) {
        endSubmit()
        setOriginalsBlocked(true)
        setError(`Nothing was sent. ${droppedLines.join(' ')}`)
        return
      }
      const kept = keptIdx.flatMap(idx => next[idx] ?? [])
      const keptTitles = keptIdx.map(idx => titles[idx] ?? '')
      const droppedOutboxIDs = effective.flatMap(({outboxID}, idx) =>
        next[idx] || !outboxID ? [] : [outboxID]
      )
      if (upload(kept, keptTitles, `Not sent: ${droppedLines.join(' ')}`)) {
        cancelAttachmentUploads(droppedOutboxIDs)
        // Only the sent ones are spent; a dropped image keeps its original.
        const sentIdx = items.flatMap((_, i) => (processed[i] && processed[i].error === undefined ? [i] : []))
        deleteConsumedSources(
          sentIdx.flatMap(i => items[i] ?? []),
          sentIdx.flatMap(i => processed[i] ?? [])
        )
      } else {
        discardProcessedOutputs(items, processed)
      }
    }

    if (skipProcessing) {
      C.ignorePromise(sendOriginals())
      return
    }

    const isUnmounted = () => unmountedRef.current
    const f = async () => {
      const compress = (await compressPrefRef.current) ?? true
      if (isUnmounted()) {
        return
      }
      if (accountChanged()) {
        endSubmit()
        return
      }
      // Only local media can be handed to the native processor: kbfs paths aren't
      // real files and non-media has nothing to compress. "Keep full size" is a raw
      // share, so with compression off only an explicit trim still needs the
      // exporter — the cut has to be applied somewhere — and images still go
      // through so formats recipients can't show (tiff, RAW, webp) come out as
      // JPEG; the rest come back untouched. Picked files are never converted, so
      // with compression off they go as they are.
      const eligible = effective.reduce(
        (l: Array<{edit?: VideoEdit; idx: number; path: string}>, {path}, idx) => {
          const edit = edits[idx]
          const needsImageWork = pickedAsFiles
            ? compress && canCompressPickedFile(path)
            : compress
              ? canProcess(path)
              : isProcessableImagePath(path)
          const needsProcessing = !isEditNoop(edit) || needsImageWork
          if (!isKbfsPath(path) && needsProcessing) {
            l.push({edit, idx, path})
          }
          return l
        },
        []
      )

      if (eligible.length === 0) {
        upload(effective)
        return
      }

      setProgress({done: 0, total: eligible.length})
      const items = eligible.map(({path, edit}) => ({edit, path}))
      const {processed, failure} = await processForSend(
        items,
        {compress},
        (done, total) => {
          if (!unmountedRef.current) {
            setProgress({done, total})
          }
        }
      )
      // Backed out while it exported: nothing uploads, so the outputs are
      // orphans, and the originals stay for a retry or a re-share.
      if (unmountedRef.current) {
        discardProcessedOutputs(items, processed)
        return
      }
      setProgress(undefined)
      // A failed export means the original bytes: an uncompressed upload, or
      // worse a clip the user asked to trim going out full length. Stop and say
      // so instead of sending something they didn't ask for. Send exports again,
      // so whatever did export this time won't be used.
      if (failure !== undefined) {
        discardProcessedOutputs(items, processed)
        endSubmit()
        setError(failure)
        return
      }
      const next = [...effective]
      eligible.forEach(({idx}, i) => {
        const cur = next[idx]
        if (cur) {
          next[idx] = {...cur, path: processed[i]?.path ?? cur.path}
        }
      })
      if (upload(next)) {
        deleteConsumedSources(items, processed)
      } else {
        discardProcessedOutputs(items, processed)
      }
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
    if ((info?.type !== 'image' && info?.type !== 'video') || info.url || !path || !isKbfsPath(path)) {
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

  const isKbfs = !!path && isKbfsPath(path)
  // kbfs paths aren't real files, so there's nothing to export from them.
  const showTrim = !!path && !isKbfs && canEdit(path)
  // A kbfs path isn't loadable as a src; it previews through the service's URL
  // once that resolves, and as a file until then (or for good if it fails).
  const mediaSrc = info.url ?? (isKbfs ? kbfsPreviewURL : path)
  const filePreview = (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
      <Kb.ImageIcon type="icon-file-uploading-48" />
    </Kb.Box2>
  )

  let preview: React.ReactNode
  switch (info.type) {
    case 'image':
      preview = mediaSrc ? (
        <Kb.ZoomableImage src={mediaSrc} style={styles.image} boxCacheKey="getTitlesImg" />
      ) : (
        filePreview
      )
      break
    case 'video':
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
      ) : mediaSrc ? (
        <Kb.Video autoPlay={false} allowFile={!isKbfs} muted={true} url={mediaSrc} />
      ) : (
        filePreview
      )
      break
    default: {
      if (isIOS && path && !isKbfs && Chat.isPathHEIC(path)) {
        preview = <Kb.ZoomableImage src={path} style={styles.image} boxCacheKey="getTitlesHeicImg" />
      } else {
        preview = filePreview
      }
    }
  }

  const isLast = index + 1 === pathAndInfos.length
  // Are we trying to upload multiple?
  const multiUpload = pathAndInfos.length > 1
  // A phone is too narrow for Send, Send All and Send original side by side.
  const stackButtons = isMobile && !!error

  return (
    <Kb.ModalScreen
      scroll={false}
      banner={
        <>
          {notice ? <Kb.Banner color="yellow">{notice}</Kb.Banner> : null}
          <Kb.ErrorBanner
            error={error}
            onClose={() => {
              setError(undefined)
            }}
          />
        </>
      }
      footer={
        <Kb.ButtonBar direction={stackButtons ? 'column' : 'row'} fullWidth={true} small={true}>
          {!isMobile && <Kb.Button fullWidth={true} type="Dim" onClick={onCancel} label="Cancel" />}
          {isLast ? (
            <Kb.Button
              disabled={!!progress || !resolvedTlfName}
              waiting={submitting}
              fullWidth={!multiUpload || stackButtons}
              onClick={onSubmit}
              label="Send"
            />
          ) : (
            <Kb.Button
              disabled={!!progress}
              fullWidth={!multiUpload || stackButtons}
              onClick={onNext}
              label="Next"
            />
          )}
          {multiUpload ? (
            <Kb.Button
              disabled={!!progress || !resolvedTlfName}
              waiting={submitting}
              fullWidth={stackButtons}
              onClick={onSubmit}
              label="Send All"
            />
          ) : null}
          {/* Send retries the export; this is the way out when it keeps failing. */}
          {error && !originalsBlocked ? (
            <Kb.Button
              disabled={!!progress || !resolvedTlfName}
              type="Dim"
              fullWidth={stackButtons}
              onClick={onSendAnyway}
              label="Send original"
            />
          ) : null}
        </Kb.ButtonBar>
      }
    >
      <Kb.ClickableBox direction="vertical" fullWidth={true} alignItems="center" style={styles.container} onClick={() => inputRef.current?.blur()}>
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
      {resolvedTlfName ? null : (
        <Kb.Text type="BodySmall" center={true} style={styles.progress}>
          {metaFailed ? "Couldn't load this conversation." : 'Loading conversation...'}
        </Kb.Text>
      )}
      {progress ? (
        <Kb.Box2 direction="horizontal" gap="tiny" alignItems="center" style={styles.progress}>
          <Kb.ProgressIndicator />
          {/* done counts completed items; the label names the one in flight */}
          <Kb.Text type="BodySmall">{`Processing ${Math.min(progress.done + 1, progress.total)} of ${progress.total}...`}</Kb.Text>
        </Kb.Box2>
      ) : null}
    </Kb.ModalScreen>
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
      container: Kb.Styles.platformStyles({
        common: {flexGrow: 1, flexShrink: 1, minHeight: 0},
        isElectron: {overflow: 'hidden'},
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
      input: {
        ...Kb.Styles.border(theme.blue, 1, Kb.Styles.borderRadius),
        maxHeight: 42,
        minHeight: 42,
        padding: Kb.Styles.globalMargins.tiny,
        width: '100%',
      },
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
