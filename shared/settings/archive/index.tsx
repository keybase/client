import * as React from 'react'
import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import {formatTimeForConversationList, formatTimeForChat} from '@/util/timestamp'

const ChatJob = React.memo(function ChatJob(p: {index: number; id: string}) {
  const {id, index} = p
  const job = C.useArchiveState(s => s.chatJobs.get(id))
  const cancel = C.useArchiveState(s => s.dispatch.cancelChat)
  const pause = C.useArchiveState(s => s.dispatch.pauseChat)
  const resume = C.useArchiveState(s => s.dispatch.resumeChat)

  const errorStr = job?.error ?? ''

  const onPause = React.useCallback(() => {
    pause(id)
  }, [pause, id])

  const onResume = React.useCallback(() => {
    resume(id)
  }, [resume, id])

  const openFinder = C.useFSState(s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop)
  const onShowFinder = React.useCallback(() => {
    if (!job) return
    openFinder?.(job.outPath)
  }, [job, openFinder])

  const onShare = React.useCallback(() => {
    if (!job?.outPath) return
    C.PlatformSpecific.showShareActionSheet({
      filePath: job.outPath,
      mimeType: 'application/zip',
    })
      .then(() => {})
      .catch(() => {})
  }, [job])

  const onCancel = React.useCallback(() => {
    cancel(id)
  }, [cancel, id])

  if (!job) return null
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
        <Kb.Text type="BodySmall">{started.toLocaleString()}</Kb.Text>
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
    <Kb.ListItem2
      firstItem={index === 0}
      type="Small"
      body={
        <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="tiny">
          <Kb.Box2 direction="vertical" style={{padding: Kb.Styles.isMobile ? 4 : 8, width: 32}}>
            <Kb.Icon type="iconfont-chat" />
          </Kb.Box2>
          <Kb.Box2 direction="vertical" fullWidth={true} style={styles.jobLeft} gap="xtiny">
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
    ></Kb.ListItem2>
  )
})

const KBFSJob = React.memo(function KBFSJob(p: {index: number; id: string}) {
  const {id, index} = p
  const job = C.useArchiveState(s => s.kbfsJobs.get(id))
  const currentTLFRevision = C.useArchiveState(s => s.kbfsJobsFreshness.get(id)) || 0
  const cancelOrDismiss = C.useArchiveState(s => s.dispatch.cancelOrDismissKBFS)

  const loadKBFSJobFreshness = C.useArchiveState(s => s.dispatch.loadKBFSJobFreshness)
  C.useOnMountOnce(() => {
    loadKBFSJobFreshness(id)
  })

  const openFinder = C.useFSState(s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop)
  const onShowFinder = React.useCallback(() => {
    if (Kb.Styles.isMobile || !job) {
      return
    }
    openFinder?.(job.zipFilePath)
  }, [job, openFinder])

  const onShare = React.useCallback(() => {
    if (!Kb.Styles.isMobile || !job) {
      return
    }
    C.PlatformSpecific.showShareActionSheet({
      filePath: job.zipFilePath,
      mimeType: 'application/zip',
    })
      .then(() => {})
      .catch(() => {})
  }, [job])

  const onCancelOrDismiss = React.useCallback(() => {
    C.ignorePromise(cancelOrDismiss(id))
  }, [cancelOrDismiss, id])

  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
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
    },
    [onShare]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)

  if (!job) {
    return null
  }
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
      ? `Archive revision ${job.kbfsRevision} behind TLF revision ${currentTLFRevision}. Make a new archive if needed.`
      : null

  return (
    <Kb.ListItem2
      firstItem={index === -1}
      type="Small"
      body={
        <Kb.Box2Measure
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
            <Kb.Icon type="icon-folder-32" />
          )}
          <Kb.Box2 direction="vertical" fullHeight={true} style={styles.kbfsJobLeft}>
            <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" alignItems="flex-end">
              <Kb.Text type="BodyBold" lineClamp={1} style={{flexShrink: 1}} ellipsizeMode="head">
                {job.gitRepo ?? job.kbfsPath}
              </Kb.Text>
              {C.isMobile ? null : <Kb.Box style={{flex: 1}} />}
              {C.isMobile ? null : job.bytesTotal ? (
                <Kb.Text type="BodySmall">{C.FS.humanReadableFileSize(job.bytesTotal)}</Kb.Text>
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
              <Kb.Box style={{flex: 1}} />
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
              <Kb.Box2 direction="vertical" alignItems="center" style={styles.kbfsActions}>
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
        </Kb.Box2Measure>
      }
    ></Kb.ListItem2>
  )
})

const Archive = C.featureFlags.archive
  ? () => {
      const load = C.useArchiveState(s => s.dispatch.load)
      const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)

      C.Router2.useSafeFocusEffect(
        React.useCallback(() => {
          load()
        }, [load])
      )

      const archiveChat = React.useCallback(() => {
        navigateAppend({props: {type: 'chatAll'}, selected: 'archiveModal'})
      }, [navigateAppend])
      const archiveFS = React.useCallback(() => {
        navigateAppend({props: {type: 'fsAll'}, selected: 'archiveModal'})
      }, [navigateAppend])
      const archiveGit = React.useCallback(() => {
        navigateAppend({props: {type: 'gitAll'}, selected: 'archiveModal'})
      }, [navigateAppend])
      const clearCompleted = C.useArchiveState(s => s.dispatch.clearCompleted)

      const chatJobMap = C.useArchiveState(s => s.chatJobs)
      const kbfsJobMap = C.useArchiveState(s => s.kbfsJobs)
      const chatJobs = [...chatJobMap.keys()]
      const kbfsJobs = [...kbfsJobMap.keys()]

      const showClear = C.useArchiveState(s => {
        for (const job of s.chatJobs.values()) {
          if (job.status === T.RPCChat.ArchiveChatJobStatus.complete) {
            return true
          }
        }
        for (const job of s.kbfsJobs.values()) {
          if (job.phase === 'Done') {
            return true
          }
        }
        return false
      })

      return (
        <Kb.ScrollView style={styles.scroll}>
          <Kb.Box2 direction="vertical" fullWidth={true} gap="medium" style={styles.container}>
            <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
              {Kb.Styles.isMobile ? null : <Kb.Text type="Header">Archive</Kb.Text>}
              <Kb.Box2 direction="vertical" style={styles.jobs} fullWidth={true} alignItems="center">
                <Kb.Text type="BodySmall" style={{alignSelf: 'center'}}>
                  Easily archive your Keybase data by choosing 'archive' in chat and files or click to archive
                  all.
                </Kb.Text>
              </Kb.Box2>
              {C.isMobile ? (
                <Kb.Box2 direction="vertical" fullWidth={true} alignItems="center" gap="xtiny">
                  <Kb.Box2 direction="horizontal" alignSelf="center" gap="xtiny">
                    <Kb.Button small={C.isMobile} label="Archive all chat" onClick={archiveChat} />
                    <Kb.Button small={C.isMobile} label="Archive all files" onClick={archiveFS} />
                  </Kb.Box2>
                  <Kb.Box2 direction="horizontal" alignSelf="center">
                    <Kb.Button small={C.isMobile} label="Archive all Git repos" onClick={archiveGit} />
                  </Kb.Box2>
                </Kb.Box2>
              ) : (
                <Kb.Box2 direction="horizontal" alignSelf="center" gap="xtiny">
                  <Kb.Button small={C.isMobile} label="Archive all chat" onClick={archiveChat} />
                  <Kb.Button small={C.isMobile} label="Archive all files" onClick={archiveFS} />
                  <Kb.Button small={C.isMobile} label="Archive all Git repos" onClick={archiveGit} />
                </Kb.Box2>
              )}
            </Kb.Box2>
            <Kb.Box2 direction="vertical" fullWidth={true} gap="tiny">
              <Kb.Text type="Header">Active archive jobs</Kb.Text>
              {chatJobs.length + kbfsJobs.length ? (
                <Kb.Box2 direction="vertical" style={styles.jobs} fullWidth={true}>
                  {chatJobs.map((id, idx) => (
                    <ChatJob id={id} key={id} index={idx} />
                  ))}
                  {kbfsJobs.map((id, idx) => (
                    <KBFSJob id={id} key={id} index={idx + chatJobs.length} />
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
                <Kb.Box2 direction="vertical" style={styles.jobs} fullWidth={true}>
                  <Kb.Text type="Body">• No active archive jobs</Kb.Text>
                </Kb.Box2>
              )}
            </Kb.Box2>
          </Kb.Box2>
        </Kb.ScrollView>
      )
    }
  : () => null

const styles = Kb.Styles.styleSheetCreate(() => ({
  action: {flexShrink: 0},
  clear: {alignSelf: 'flex-start', marginTop: 16},
  container: {padding: Kb.Styles.isMobile ? 8 : 16},
  errorTip: {justifyContent: 'center'},
  jobLeft: {flexGrow: 1, flexShrink: 1},
  jobSub: {height: 22},
  jobs: {
    flexGrow: 1,
    flexShrink: 1,
  },
  kbfsActions: {
    alignSelf: 'center',
    flexShrink: 0,
    justifyContent: 'flex-end',
    paddingLeft: 8,
  },
  kbfsCancel: {color: Kb.Styles.globalColors.red},
  kbfsJobLeft: {
    flexGrow: 1,
    flexShrink: 1,
    justifyContent: 'center',
  },
  kbfsJobRight: {flexShrink: 0},
  kbfsProgress: {
    height: Kb.Styles.globalMargins.small,
  },
  scroll: {height: '100%', width: '100%'},
}))

export default Archive
