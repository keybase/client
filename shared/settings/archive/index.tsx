import * as React from 'react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {useEngineActionListener} from '@/engine/action-listener'
import {formatTimeForConversationList, formatTimeForChat, formatTimeForPopup} from '@/util/timestamp'
import * as FS from '@/stores/fs'
import {showShareActionSheet} from '@/util/platform-specific'
import {openLocalPathInSystemFileManagerDesktop} from '@/util/fs-storeless-actions'

type ChatArchiveJob = {
  id: string
  context: string
  started: string
  progress: number
  outPath: string
  error?: string
  status: T.RPCChat.ArchiveChatJobStatus
}

type KBFSJobPhase = 'Queued' | 'Indexing' | 'Indexed' | 'Copying' | 'Copied' | 'Zipping' | 'Done'

type KBFSArchiveJob = {
  id: string
  started: Date
  phase: KBFSJobPhase
  kbfsPath: string
  gitRepo?: string
  kbfsRevision: number
  zipFilePath: string
  bytesTotal: number
  bytesCopied: number
  bytesZipped: number
  error?: string
  errorNextRetry?: Date
}

const mapKBFSJobs = (status: T.RPCGen.SimpleFSArchiveStatus) =>
  new Map(
    (status.jobs ?? []).map(job => [
      job.desc.jobID,
      {
        bytesCopied: job.bytesCopied,
        bytesTotal: job.bytesTotal,
        bytesZipped: job.bytesZipped,
        error: job.error?.error,
        errorNextRetry: job.error?.nextRetry,
        gitRepo: job.desc.gitRepo,
        id: job.desc.jobID,
        kbfsPath: job.desc.kbfsPathWithRevision.path,
        kbfsRevision:
          job.desc.kbfsPathWithRevision.archivedParam.KBFSArchivedType === T.RPCGen.KBFSArchivedType.revision
            ? job.desc.kbfsPathWithRevision.archivedParam.revision
            : 0,
        phase: {
          [T.RPCGen.SimpleFSArchiveJobPhase.queued]: 'Queued',
          [T.RPCGen.SimpleFSArchiveJobPhase.indexing]: 'Indexing',
          [T.RPCGen.SimpleFSArchiveJobPhase.indexed]: 'Indexed',
          [T.RPCGen.SimpleFSArchiveJobPhase.copying]: 'Copying',
          [T.RPCGen.SimpleFSArchiveJobPhase.copied]: 'Copied',
          [T.RPCGen.SimpleFSArchiveJobPhase.zipping]: 'Zipping',
          [T.RPCGen.SimpleFSArchiveJobPhase.done]: 'Done',
        }[job.phase],
        started: new Date(job.desc.startTime),
        zipFilePath: job.desc.zipFilePath,
      } as KBFSArchiveJob,
    ])
  )

const loadChatJobs = async () => {
  const res = await T.RPCChat.localArchiveChatListRpcPromise({
    identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset,
  })
  const chatJobs = new Map<string, ChatArchiveJob>()
  res.jobs?.forEach(job => {
    const id = job.request.jobID
    let context = ''
    if (!job.request.query?.name && !job.request.query?.topicName && !job.request.query?.convIDs?.length) {
      context = '<all chat>'
    } else if (job.matchingConvs?.length) {
      const conv = job.matchingConvs.find(mc => mc.name)
      context = conv?.name ?? ''
      if (conv?.channel) {
        context += `#${conv.channel}`
      }
    } else {
      context = '<pending>'
    }
    chatJobs.set(id, {
      context,
      error: job.err,
      id,
      outPath: `${job.request.outputPath}.tar.gzip`,
      progress: job.messagesTotal ? job.messagesComplete / job.messagesTotal : 0,
      started: formatTimeForPopup(job.startedAt),
      status: job.status,
    })
  })
  return chatJobs
}

const loadKBFSJobs = async () =>
  mapKBFSJobs(await T.RPCGen.SimpleFSSimpleFSGetArchiveStatusRpcPromise())

const updateChatProgress = (
  chatJobs: Map<string, ChatArchiveJob>,
  p: {jobID: string; messagesComplete: number; messagesTotal: number}
) => {
  const job = chatJobs.get(p.jobID)
  if (!job) {
    return {chatJobs, reload: true}
  }
  return {
    chatJobs: new Map(chatJobs).set(p.jobID, {
      ...job,
      progress: p.messagesTotal ? p.messagesComplete / p.messagesTotal : 0,
      status: T.RPCChat.ArchiveChatJobStatus.running,
    }),
    reload: false,
  }
}

const useArchiveJobs = () => {
  const [chatJobs, setChatJobs] = React.useState<Map<string, ChatArchiveJob>>(() => new Map())
  const [kbfsJobs, setKBFSJobs] = React.useState<Map<string, KBFSArchiveJob>>(() => new Map())
  const chatLoadVersionRef = React.useRef(0)
  const kbfsLoadVersionRef = React.useRef(0)

  const loadChat = React.useEffectEvent(async () => {
    const loadVersion = ++chatLoadVersionRef.current
    const nextChatJobs = await loadChatJobs()
    if (loadVersion !== chatLoadVersionRef.current) {
      return
    }
    setChatJobs(nextChatJobs)
  })

  const loadKBFS = React.useEffectEvent(async () => {
    const loadVersion = ++kbfsLoadVersionRef.current
    const nextKBFSJobs = await loadKBFSJobs()
    if (loadVersion !== kbfsLoadVersionRef.current) {
      return
    }
    setKBFSJobs(nextKBFSJobs)
  })

  const load = React.useEffectEvent(() => {
    C.ignorePromise(loadChat())
    C.ignorePromise(loadKBFS())
  })

  useEngineActionListener('keybase.1.NotifySimpleFS.simpleFSArchiveStatusChanged', action => {
    kbfsLoadVersionRef.current++
    setKBFSJobs(mapKBFSJobs(action.payload.params.status))
  })

  useEngineActionListener('chat.1.NotifyChat.ChatArchiveComplete', () => {
    C.ignorePromise(loadChat())
  })

  useEngineActionListener('chat.1.NotifyChat.ChatArchiveProgress', action => {
    let shouldReload = false
    setChatJobs(chatJobs => {
      const next = updateChatProgress(chatJobs, action.payload.params)
      shouldReload = next.reload
      return next.chatJobs
    })
    if (shouldReload) {
      C.ignorePromise(loadChat())
    }
  })

  return {chatJobs, kbfsJobs, load, loadChat}
}

function ChatJob(p: {index: number; job: ChatArchiveJob; loadChat: () => Promise<void>}) {
  const {index, job, loadChat} = p
  const {id} = job
  const cancelChat = C.useRPC(T.RPCChat.localArchiveChatDeleteRpcPromise)
  const pauseChat = C.useRPC(T.RPCChat.localArchiveChatPauseRpcPromise)
  const resumeChat = C.useRPC(T.RPCChat.localArchiveChatResumeRpcPromise)

  const errorStr = job.error ?? ''

  const onPause = () => {
    pauseChat(
      [{identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset, jobID: id}],
      () => {
        C.ignorePromise(loadChat())
      },
      () => {}
    )
  }

  const onResume = () => {
    resumeChat([{identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset, jobID: id}], () => {}, () => {})
  }

  const onShowFinder = () => {
    openLocalPathInSystemFileManagerDesktop(job.outPath)
  }

  const onShare = () => {
    if (!job.outPath) return
    showShareActionSheet({
      filePath: job.outPath,
      mimeType: 'application/zip',
    })
      .then(() => {})
      .catch(() => {})
  }

  const onCancel = () => {
    cancelChat(
      [{deleteOutputPath: true, identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset, jobID: id}],
      () => {
        C.ignorePromise(loadChat())
      },
      () => {}
    )
  }

  const {started, progress, outPath, context, status} = job
  const done = status === T.RPCChat.ArchiveChatJobStatus.complete
  const sub = Kb.Styles.isMobile ? (
    <Kb.Text type="BodyBold" lineClamp={1}>
      {context}
    </Kb.Text>
  ) : (
    <Kb.Text type="Body" lineClamp={1} title={`${context} => ${outPath}`}>
      <Kb.Text type="BodyBold">{context}</Kb.Text>
    </Kb.Text>
  )

  let actions: React.ReactNode
  if (done) {
    actions = (
      <Kb.Box2 direction="vertical" style={styles.action}>
        <Kb.Text type="BodySmall">{started}</Kb.Text>
        {Kb.Styles.isMobile ? (
          <Kb.Text type="BodyPrimaryLink" onClick={onShare}>
            Share
          </Kb.Text>
        ) : (
          <Kb.Text type="BodyPrimaryLink" onClick={onShowFinder}>
            Show in {C.fileUIName}
          </Kb.Text>
        )}
      </Kb.Box2>
    )
  } else {
    const isPaused =
      job.status === T.RPCChat.ArchiveChatJobStatus.paused ||
      job.status === T.RPCChat.ArchiveChatJobStatus.backgroundPaused
    const isErr = job.status === T.RPCChat.ArchiveChatJobStatus.error

    let pauseOrResume: React.ReactNode
    if (isPaused || isErr) {
      pauseOrResume = Kb.Styles.isMobile ? (
        <Kb.Icon type="iconfont-play" onClick={onResume} />
      ) : (
        <Kb.Button label={isPaused ? 'Resume' : 'Retry'} onClick={onResume} small={true} />
      )
    } else if (job.status === T.RPCChat.ArchiveChatJobStatus.running) {
      pauseOrResume = Kb.Styles.isMobile ? (
        <Kb.Icon type="iconfont-pause" onClick={onPause} />
      ) : (
        <Kb.Button label="Pause" onClick={onPause} small={true} />
      )
    }

    actions = (
      <Kb.Box2 direction="horizontal" style={styles.action} gap="tiny">
        {pauseOrResume}
        {Kb.Styles.isMobile ? (
          <Kb.Icon color={Kb.Styles.globalColors.red} type="iconfont-remove" onClick={onCancel} />
        ) : (
          <Kb.Button type="Danger" label="Cancel" onClick={onCancel} small={true} />
        )}
      </Kb.Box2>
    )
  }

  return (
    <Kb.ListItem
      firstItem={index === 0}
      type="Small"
      body={
        <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="tiny">
          <Kb.Box2 direction="vertical" style={{padding: Kb.Styles.isMobile ? 4 : 8, width: 32}}>
            <Kb.Icon type="iconfont-chat" />
          </Kb.Box2>
          <Kb.Box2 direction="vertical" fullWidth={true} flex={1} style={styles.jobLeft} gap="xtiny">
            {sub}
            {!done && <Kb.ProgressBar ratio={progress} />}
          </Kb.Box2>
          {errorStr && (
            <Kb.WithTooltip tooltip={errorStr} showOnPressMobile={true} containerStyle={styles.errorTip}>
              <Kb.Icon type="iconfont-exclamation" color={Kb.Styles.globalColors.red} />
            </Kb.WithTooltip>
          )}
          {actions}
        </Kb.Box2>
      }
    ></Kb.ListItem>
  )
}

function KBFSJob(p: {index: number; job: KBFSArchiveJob}) {
  const {index, job} = p
  const {id} = job
  const [currentTLFRevision, setCurrentTLFRevision] = React.useState(0)
  const cancelOrDismissKBFS = C.useRPC(T.RPCGen.SimpleFSSimpleFSArchiveCancelOrDismissJobRpcPromise)
  const loadKBFSJobFreshness = C.useRPC(T.RPCGen.SimpleFSSimpleFSGetArchiveJobFreshnessRpcPromise)
  C.useOnMountOnce(() => {
    loadKBFSJobFreshness(
      [{jobID: id}],
      resp => {
        setCurrentTLFRevision(resp.currentTLFRevision)
      },
      () => {}
    )
  })

  const onShowFinder = () => {
    if (Kb.Styles.isMobile) {
      return
    }
    openLocalPathInSystemFileManagerDesktop(job.zipFilePath)
  }

  const onShare = () => {
    if (!Kb.Styles.isMobile) {
      return
    }
    showShareActionSheet({filePath: job.zipFilePath, mimeType: 'application/zip'})
      .then(() => {})
      .catch(() => {})
  }

  const onCancelOrDismiss = () => {
    cancelOrDismissKBFS([{jobID: id}], () => {}, () => {})
  }

  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    return (
      <Kb.FloatingMenu
        attachTo={attachTo}
        closeOnSelect={true}
        items={[{onClick: onShare, title: 'Share'}]}
        onHidden={hidePopup}
        visible={true}
        position="bottom center"
      />
    )
  }
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  const progress = job.bytesTotal
    ? (job.bytesCopied * 0.8 + job.bytesZipped * 0.2) / job.bytesTotal
    : job.phase === 'Zipping'
      ? 0.8
      : job.phase === 'Done'
        ? 1
        : 0
  const errorStr = job.error
    ? `Error: ${job.error} | Retrying at ${new Date(job.errorNextRetry || 0).toLocaleString()}`
    : null
  const revisionBehindStr =
    job.kbfsRevision < currentTLFRevision
      ? `Backup revision ${job.kbfsRevision} behind TLF revision ${currentTLFRevision}. Make a new backup if needed.`
      : null

  return (
    <Kb.ListItem
      firstItem={index === -1}
      type="Small"
      body={
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          alignItems="center"
          gap="tiny"
          fullHeight={true}
          ref={popupAnchor}
        >
          {job.gitRepo ? (
            <Kb.Icon type="iconfont-nav-2-git" fontSize={32} />
          ) : (
            <Kb.ImageIcon type="icon-folder-32" />
          )}
          <Kb.Box2 direction="vertical" fullHeight={true} justifyContent="center" flex={1} style={styles.kbfsJobLeft}>
            <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" alignItems="flex-end">
              <Kb.Text type="BodyBold" lineClamp={1} style={{flexShrink: 1}} ellipsizeMode="head">
                {job.gitRepo ?? job.kbfsPath}
              </Kb.Text>
              {C.isMobile ? null : <Kb.Box2 direction="horizontal" style={{flex: 1}} />}
              {C.isMobile ? null : job.bytesTotal ? (
                <Kb.Text type="BodySmall">{FS.humanReadableFileSize(job.bytesTotal)}</Kb.Text>
              ) : null}
              <Kb.Text type="BodySmall" style={{flexShrink: 0}}>
                {C.isMobile
                  ? formatTimeForConversationList(job.started.getTime())
                  : formatTimeForChat(job.started.getTime())}
              </Kb.Text>
            </Kb.Box2>
            <Kb.Box2
              direction="horizontal"
              alignItems="center"
              fullWidth={true}
              style={styles.kbfsProgress}
              gap="tiny"
            >
              <Kb.ProgressBar ratio={progress} />
              <Kb.Text type="Body">{Math.round(progress * 100) + '%'}</Kb.Text>
              <Kb.Box2 direction="horizontal" style={{flex: 1}} />
              {errorStr && (
                <Kb.WithTooltip tooltip={errorStr} showOnPressMobile={true}>
                  <Kb.Icon type="iconfont-exclamation" color={Kb.Styles.globalColors.red} fontSize={14} />
                </Kb.WithTooltip>
              )}
              {!C.isMobile && revisionBehindStr && (
                <Kb.WithTooltip tooltip={revisionBehindStr}>
                  <Kb.Icon
                    type="iconfont-exclamation"
                    color={Kb.Styles.globalColors.yellowDark}
                    fontSize={14}
                  />
                </Kb.WithTooltip>
              )}
              <Kb.Text type={job.phase === 'Done' ? 'BodySmallSuccess' : 'BodySmall'}>{job.phase}</Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Box2 direction="vertical" alignItems="flex-end" style={styles.kbfsJobRight}>
            {C.isMobile ? (
              <Kb.Box2 direction="horizontal" alignItems="center" style={{padding: 8}}>
                {job.phase === 'Done' ? (
                  <Kb.Icon onClick={showPopup} type="iconfont-ellipsis" />
                ) : (
                  <Kb.Icon
                    color={Kb.Styles.globalColors.red}
                    type="iconfont-remove"
                    onClick={onCancelOrDismiss}
                  />
                )}
              </Kb.Box2>
            ) : (
              <Kb.Box2 direction="vertical" alignItems="center" justifyContent="flex-end" style={styles.kbfsActions}>
                {job.phase === 'Done' ? (
                  <Kb.Text type="BodySmallPrimaryLink" onClick={onShowFinder}>
                    Show in {C.fileUIName}
                  </Kb.Text>
                ) : (
                  <Kb.Text style={styles.kbfsCancel} type="BodySmallPrimaryLink" onClick={onCancelOrDismiss}>
                    Cancel
                  </Kb.Text>
                )}
                {job.phase === 'Done' ? (
                  <Kb.Text type="BodySmallPrimaryLink" onClick={onCancelOrDismiss}>
                    Dismiss
                  </Kb.Text>
                ) : null}
              </Kb.Box2>
            )}
          </Kb.Box2>
          {popup}
        </Kb.Box2>
      }
    ></Kb.ListItem>
  )
}

const Archive = () => {
  const {chatJobs, kbfsJobs, load, loadChat} = useArchiveJobs()
  const navigateAppend = C.Router2.navigateAppend

  C.Router2.useSafeFocusEffect(() => {
    load()
  })

  let showClear = false
  for (const job of chatJobs.values()) {
    if (job.status === T.RPCChat.ArchiveChatJobStatus.complete) {
      showClear = true
      break
    }
  }
  if (!showClear) {
    for (const job of kbfsJobs.values()) {
      if (job.phase === 'Done') {
        showClear = true
        break
      }
    }
  }

  const clearCompleted = () => {
    C.ignorePromise(
      (async () => {
        await Promise.allSettled([
          ...[...chatJobs.values()].flatMap(job =>
            job.status === T.RPCChat.ArchiveChatJobStatus.complete
              ? [
                  T.RPCChat.localArchiveChatDeleteRpcPromise({
                    deleteOutputPath: C.isMobile,
                    identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset,
                    jobID: job.id,
                  }),
                ]
              : []
          ),
          ...[...kbfsJobs.values()].flatMap(job =>
            job.phase === 'Done'
              ? [T.RPCGen.SimpleFSSimpleFSArchiveCancelOrDismissJobRpcPromise({jobID: job.id})]
              : []
          ),
        ])
        load()
      })()
    )
  }

  const archiveChat = () => {
    navigateAppend({name: 'archiveModal', params: {type: 'chatAll'}})
  }
  const archiveFS = () => {
    navigateAppend({name: 'archiveModal', params: {type: 'fsAll'}})
  }
  const archiveGit = () => {
    navigateAppend({name: 'archiveModal', params: {type: 'gitAll'}})
  }

  const chatJobsList = [...chatJobs.values()]
  const kbfsJobsList = [...kbfsJobs.values()]

  return (
    <Kb.ScrollView style={styles.scroll}>
      <Kb.Box2 direction="vertical" fullWidth={true} gap="medium" style={styles.container}>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
          {Kb.Styles.isMobile ? null : <Kb.Text type="Header">Archive</Kb.Text>}
          <Kb.Box2 direction="vertical" flex={1} style={styles.jobs} fullWidth={true} alignItems="center">
            <Kb.Text type="BodySmall" style={{alignSelf: 'center'}}>
              {
                "Easily backup your Keybase data by choosing 'backup' in chat and files or click to backup all."
              }
            </Kb.Text>
          </Kb.Box2>
          {C.isMobile ? (
            <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center" gap="xtiny">
              <Kb.Box2 direction="horizontal" alignSelf="center" gap="xtiny">
                <Kb.Button small={C.isMobile} label="Backup all chat" onClick={archiveChat} />
                <Kb.Button small={C.isMobile} label="Backup all files" onClick={archiveFS} />
              </Kb.Box2>
              <Kb.Box2 direction="horizontal" alignSelf="center">
                <Kb.Button small={C.isMobile} label="Backup all Git repos" onClick={archiveGit} />
              </Kb.Box2>
            </Kb.Box2>
          ) : (
            <Kb.Box2 direction="horizontal" alignSelf="center" gap="xtiny">
              <Kb.Button small={C.isMobile} label="Backup all chat" onClick={archiveChat} />
              <Kb.Button small={C.isMobile} label="Backup all files" onClick={archiveFS} />
              <Kb.Button small={C.isMobile} label="Backup all Git repos" onClick={archiveGit} />
            </Kb.Box2>
          )}
        </Kb.Box2>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
          <Kb.Text type="Header">Active backup jobs</Kb.Text>
          {chatJobsList.length + kbfsJobsList.length ? (
            <Kb.Box2 direction="vertical" flex={1} style={styles.jobs} fullWidth={true}>
              {chatJobsList.map((job, idx) => (
                <ChatJob job={job} key={job.id} index={idx} loadChat={loadChat} />
              ))}
              {kbfsJobsList.map((job, idx) => (
                <KBFSJob job={job} key={job.id} index={idx + chatJobsList.length} />
              ))}
              {showClear ? (
                <Kb.Button
                  mode="Secondary"
                  label="Clear completed"
                  onClick={clearCompleted}
                  style={styles.clear}
                />
              ) : null}
            </Kb.Box2>
          ) : (
            <Kb.Box2 direction="vertical" flex={1} style={styles.jobs} fullWidth={true}>
              <Kb.Text type="Body">• No active backup jobs</Kb.Text>
            </Kb.Box2>
          )}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ScrollView>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  action: {flexShrink: 0},
  clear: {alignSelf: 'flex-start', marginTop: 16},
  container: {padding: Kb.Styles.isMobile ? 8 : 16},
  errorTip: {justifyContent: 'center'},
  jobLeft: {flexShrink: 1},
  jobs: {
    flexShrink: 1,
  },
  kbfsActions: {
    alignSelf: 'center',
    flexShrink: 0,
    paddingLeft: 8,
  },
  kbfsCancel: {color: Kb.Styles.globalColors.red},
  kbfsJobLeft: {
    flexShrink: 1,
  },
  kbfsJobRight: {flexShrink: 0},
  kbfsProgress: {
    height: Kb.Styles.globalMargins.small,
  },
  scroll: {height: '100%', width: '100%'},
}))

export default Archive
