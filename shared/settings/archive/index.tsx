import * as React from 'react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {useEngineActionListener} from '@/engine/action-listener'
import {formatTimeForConversationList, formatTimeForChat} from '@/util/timestamp'
import * as FS from '@/constants/fs'
import {showShareActionSheet} from '@/util/platform-specific'
import {openLocalPathInSystemFileManagerDesktop} from '@/util/fs-storeless-actions'
import {
  type ChatArchiveJob,
  type KBFSArchiveJob,
  mapChatJobs,
  mapKBFSJobs,
  updateChatProgress,
} from './job-state'

const loadChatJobs = async () => {
  const res = await T.RPCChat.localArchiveChatListRpcPromise({
    identifyBehavior: T.RPCGen.TLFIdentifyBehavior.unset,
  })
  return mapChatJobs(res.jobs)
}

const loadKBFSJobs = async () =>
  mapKBFSJobs(await T.RPCGen.SimpleFSSimpleFSGetArchiveStatusRpcPromise())

const useArchiveJobs = () => {
  const [chatJobs, setChatJobs] = React.useState<Map<string, ChatArchiveJob>>(() => new Map())
  const [kbfsJobs, setKBFSJobs] = React.useState<Map<string, KBFSArchiveJob>>(() => new Map())
  const chatJobsRef = React.useRef(chatJobs)
  const chatLoadVersionRef = React.useRef(0)
  const kbfsLoadVersionRef = React.useRef(0)

  const loadChat = React.useEffectEvent(async () => {
    const loadVersion = ++chatLoadVersionRef.current
    const nextChatJobs = await loadChatJobs()
    if (loadVersion !== chatLoadVersionRef.current) {
      return
    }
    chatJobsRef.current = nextChatJobs
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
    const next = updateChatProgress(chatJobsRef.current, action.payload.params)
    chatJobsRef.current = next.chatJobs
    setChatJobs(next.chatJobs)
    if (next.reload) {
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
  const sub = isMobile ? (
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
      <Kb.Box2 direction="vertical" noShrink={true}>
        <Kb.Text type="BodySmall">{started}</Kb.Text>
        {isMobile ? (
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
      pauseOrResume = isMobile ? (
        <Kb.Icon type="iconfont-play" onClick={onResume} />
      ) : (
        <Kb.Button label={isPaused ? 'Resume' : 'Retry'} onClick={onResume} small={true} />
      )
    } else if (job.status === T.RPCChat.ArchiveChatJobStatus.running) {
      pauseOrResume = isMobile ? (
        <Kb.Icon type="iconfont-pause" onClick={onPause} />
      ) : (
        <Kb.Button label="Pause" onClick={onPause} small={true} />
      )
    }

    actions = (
      <Kb.Box2 direction="horizontal" noShrink={true} gap="tiny">
        {pauseOrResume}
        {isMobile ? (
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
          <Kb.Box2 direction="vertical" style={{padding: isMobile ? 4 : 8, width: 32}}>
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
    if (isMobile) {
      return
    }
    openLocalPathInSystemFileManagerDesktop(job.zipFilePath)
  }

  const onShare = () => {
    if (!isMobile) {
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
      firstItem={index === 0}
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
              {isMobile ? null : <Kb.Box2 direction="horizontal" flex={1} />}
              {isMobile ? null : job.bytesTotal ? (
                <Kb.Text type="BodySmall">{FS.humanReadableFileSize(job.bytesTotal)}</Kb.Text>
              ) : null}
              <Kb.Text type="BodySmall" style={{flexShrink: 0}}>
                {isMobile
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
              <Kb.Text type="Body">{String(Math.round(progress * 100)) + '%'}</Kb.Text>
              <Kb.Box2 direction="horizontal" flex={1} />
              {errorStr && (
                <Kb.WithTooltip tooltip={errorStr} showOnPressMobile={true}>
                  <Kb.Icon type="iconfont-exclamation" color={Kb.Styles.globalColors.red} fontSize={14} />
                </Kb.WithTooltip>
              )}
              {!isMobile && revisionBehindStr && (
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
          <Kb.Box2 direction="vertical" alignItems="flex-end" noShrink={true}>
            {isMobile ? (
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
              <Kb.Box2 direction="vertical" alignItems="center" justifyContent="flex-end" alignSelf="center" noShrink={true} style={styles.kbfsActions}>
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

const ArchiveButtonRow = ({children}: {children: React.ReactNode}) => (
  <Kb.Box2 direction="horizontal" alignSelf="center" gap="xtiny">
    {children}
  </Kb.Box2>
)

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
                    deleteOutputPath: isMobile,
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
    <Kb.ScrollView style={styles.scroll} testID={TestIDs.SETTINGS_ARCHIVE}>
      <Kb.Box2 direction="vertical" fullWidth={true} gap="medium" style={styles.container}>
        <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
          {isMobile ? null : <Kb.Text type="Header">Archive</Kb.Text>}
          <Kb.Box2 direction="vertical" flex={1} style={styles.jobs} fullWidth={true} alignItems="center">
            <Kb.Text type="BodySmall">
              {
                "Easily backup your Keybase data by choosing 'backup' in chat and files or click to backup all."
              }
            </Kb.Text>
          </Kb.Box2>
          {isMobile ? (
            <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center" gap="xtiny">
              <ArchiveButtonRow>
                <Kb.Button small={isMobile} label="Backup all chat" onClick={archiveChat} />
                <Kb.Button small={isMobile} label="Backup all files" onClick={archiveFS} />
              </ArchiveButtonRow>
              <ArchiveButtonRow>
                <Kb.Button small={isMobile} label="Backup all Git repos" onClick={archiveGit} />
              </ArchiveButtonRow>
            </Kb.Box2>
          ) : (
            <ArchiveButtonRow>
              <Kb.Button small={isMobile} label="Backup all chat" onClick={archiveChat} />
              <Kb.Button small={isMobile} label="Backup all files" onClick={archiveFS} />
              <Kb.Button small={isMobile} label="Backup all Git repos" onClick={archiveGit} />
            </ArchiveButtonRow>
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
  clear: {alignSelf: 'flex-start', marginTop: 16},
  container: {padding: isMobile ? 8 : 16},
  errorTip: {justifyContent: 'center'},
  jobLeft: {flexShrink: 1},
  jobs: {
    flexShrink: 1,
  },
  kbfsActions: {
    paddingLeft: 8,
  },
  kbfsCancel: {color: Kb.Styles.globalColors.red},
  kbfsJobLeft: {
    flexShrink: 1,
  },
  kbfsProgress: {
    height: Kb.Styles.globalMargins.small,
  },
  scroll: Kb.Styles.size('100%'),
}))

export default Archive
