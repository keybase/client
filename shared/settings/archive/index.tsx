import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'

const Job = React.memo(function Job(p: {index: number; id: string}) {
  const {id, index} = p
  const m = C.useArchiveState(s => s.jobs.get(id))
  const cancel = C.useArchiveState(s => s.dispatch.cancel)

  const openFinder = C.useFSState(s => s.dispatch.dynamic.openLocalPathInSystemFileManagerDesktop)
  const onShowFinder = React.useCallback(() => {
    if (!m) return
    openFinder?.(m.outPath)
  }, [m, openFinder])

  const onShare = React.useCallback(() => {
    if (!m?.outPath) return
    C.PlatformSpecific.showShareActionSheet({
      filePath: m.outPath,
      mimeType: 'application/zip',
    })
      .then(() => {})
      .catch(() => {})
  }, [m])

  const onCancel = React.useCallback(() => {
    cancel(id)
  }, [cancel, id])

  if (!m) return null
  const {started, progress, outPath, context} = m
  const done = progress === 1
  const sub = Kb.Styles.isMobile ? (
    <Kb.Text type="BodyBold" lineClamp={1}>
      {context}
    </Kb.Text>
  ) : (
    <Kb.Text type="Body" lineClamp={1} title={`${context} => ${outPath}`}>
      <Kb.Text type="BodyBold">{context}</Kb.Text>
      {` => ${outPath}`}
    </Kb.Text>
  )
  return (
    <Kb.ListItem2
      firstItem={index === 0}
      type="Small"
      body={
        <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="tiny">
          <Kb.Box2 direction="vertical" style={styles.jobLeft}>
            <Kb.Text type="Body">
              {Kb.Styles.isMobile ? `Job: (${started})` : `Job ${id}: (started: ${started})`}
            </Kb.Text>
            <Kb.Box2
              direction="horizontal"
              fullWidth={true}
              alignItems="center"
              gap="tiny"
              style={styles.jobSub}
            >
              <Kb.ProgressBar ratio={progress} />
              <Kb.BoxGrow2>{sub}</Kb.BoxGrow2>
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Box2 direction="vertical" style={styles.action}>
            {done ? (
              Kb.Styles.isMobile ? (
                <Kb.Text type="BodyPrimaryLink" onClick={onShare}>
                  Share
                </Kb.Text>
              ) : (
                <Kb.Text type="BodyPrimaryLink" onClick={onShowFinder}>
                  Show in {C.fileUIName}
                </Kb.Text>
              )
            ) : Kb.Styles.isMobile ? (
              <Kb.Icon color={Kb.Styles.globalColors.red} type="iconfont-remove" onClick={onCancel} />
            ) : (
              <Kb.Button type="Danger" label="Cancel" onClick={onCancel} small={true} />
            )}
          </Kb.Box2>
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
    cancelOrDismiss(id)
  }, [cancelOrDismiss, id])

  if (!job) {
    return null
  }
  const progress = job.bytesTotal ? (job.bytesCopied * 0.8 + job.bytesZipped * 0.2) / job.bytesTotal : 0
  const errorStr = job.error
    ? `Error: ${job.error} | Retrying at ${job.errorNextRetry?.toLocaleString()}`
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
        <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="medium">
          <Kb.Icon type="icon-folder-32" />
          <Kb.Box2 direction="vertical" style={styles.kbfsJobLeft}>
            <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" alignItems="flex-end">
              <Kb.Text type="BodyBold" lineClamp={1}>
                {job.kbfsPath}
              </Kb.Text>
              <Kb.Box style={{flex: 1}} />
              {job.bytesTotal ? (
                <Kb.Text type="BodySmall">{C.FS.humanReadableFileSize(job.bytesTotal)}</Kb.Text>
              ) : null}
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
                <Kb.WithTooltip tooltip={errorStr}>
                  <Kb.Icon type="iconfont-exclamation" color={Kb.Styles.globalColors.red} />
                </Kb.WithTooltip>
              )}
              {revisionBehindStr && (
                <Kb.WithTooltip tooltip={revisionBehindStr}>
                  <Kb.Icon type="iconfont-exclamation" color={Kb.Styles.globalColors.yellowDark} />
                </Kb.WithTooltip>
              )}
              <Kb.Text type={job.phase === 'Done' ? 'BodySmallSuccess' : 'BodySmall'}>{job.phase}</Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Box2 direction="vertical" alignItems="flex-end" style={styles.kbfsJobRight}>
            <Kb.Text type="BodySmall">{job.started.toLocaleString()}</Kb.Text>
            <Kb.Box2
              direction="horizontal"
              fullWidth={true}
              alignItems="center"
              gap="tiny"
              style={styles.kbfsActions}
            >
              {job.phase === 'Done' ? (
                Kb.Styles.isMobile ? (
                  <Kb.Text type="BodyPrimaryLink" onClick={onShare}>
                    Share
                  </Kb.Text>
                ) : (
                  <Kb.Text type="BodyPrimaryLink" onClick={onShowFinder}>
                    Show in {C.fileUIName}
                  </Kb.Text>
                )
              ) : Kb.Styles.isMobile ? (
                <Kb.Icon
                  color={Kb.Styles.globalColors.red}
                  type="iconfont-remove"
                  onClick={onCancelOrDismiss}
                />
              ) : (
                <Kb.Text style={styles.kbfsCancel} type="BodyPrimaryLink" onClick={onCancelOrDismiss}>
                  Cancel
                </Kb.Text>
              )}
              {job.phase === 'Done' ? (
                <Kb.Text type="BodyPrimaryLink" onClick={onCancelOrDismiss}>
                  Dismiss
                </Kb.Text>
              ) : null}
            </Kb.Box2>
          </Kb.Box2>
        </Kb.Box2>
      }
    ></Kb.ListItem2>
  )
})

const Archive = C.featureFlags.archive
  ? () => {
      const load = C.useArchiveState(s => s.dispatch.load)
      const loadKBFS = C.useArchiveState(s => s.dispatch.loadKBFS)
      const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)

      C.useOnMountOnce(() => {
        load()
        loadKBFS()
      })

      const archiveChat = React.useCallback(() => {
        navigateAppend({props: {type: 'chatAll'}, selected: 'archiveModal'})
      }, [navigateAppend])
      const archiveFS = React.useCallback(() => {
        navigateAppend({props: {type: 'fsAll'}, selected: 'archiveModal'})
      }, [navigateAppend])
      const clearCompleted = C.useArchiveState(s => s.dispatch.clearCompleted)

      const jobMap = C.useArchiveState(s => s.jobs)
      const kbfsJobMap = C.useArchiveState(s => s.kbfsJobs)
      const jobs = [...jobMap.keys()]
      const kbfsJobs = [...kbfsJobMap.keys()]

      const showClear = C.useArchiveState(s => {
        for (const job of s.jobs.values()) {
          if (job.progress === 1) {
            return true
          }
        }
        return false
      })

      return (
        <Kb.ScrollView style={styles.scroll}>
          <Kb.Box2 direction="vertical" fullWidth={true} gap="medium" style={styles.container}>
            <Kb.Box2 direction="vertical" fullWidth={true}>
              {Kb.Styles.isMobile ? null : <Kb.Text type="Header">Archive</Kb.Text>}
              <Kb.Box2 direction="vertical" style={styles.jobs} fullWidth={true}>
                <Kb.Text type="Body">
                  Easily archive your keybase data by choosing 'archive' from menus in chat and KBFS or click
                  to archive all.
                </Kb.Text>
              </Kb.Box2>
              <Kb.ButtonBar>
                <Kb.Button label="Archive all chat" onClick={archiveChat} />
                <Kb.Button label="Archive all KBFS" onClick={archiveFS} />
              </Kb.ButtonBar>
            </Kb.Box2>
            <Kb.Box2 direction="vertical" fullWidth={true}>
              <Kb.Text type="Header">Active archive jobs</Kb.Text>
              {jobs.length ? (
                <Kb.Box2 direction="vertical" style={styles.jobs} fullWidth={true}>
                  {jobs.map((id, idx) => (
                    <Job id={id} key={id} index={idx} />
                  ))}
                  {kbfsJobs.map((id, idx) => (
                    <KBFSJob id={id} key={id} index={idx + jobs.length} />
                  ))}
                  {showClear ? (
                    <Kb.Button label="Clear completed" onClick={clearCompleted} style={styles.clear} />
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
  jobLeft: {flexGrow: 1, flexShrink: 1},
  jobSub: {height: 22},
  jobs: {
    flexGrow: 1,
    flexShrink: 1,
    paddingLeft: Kb.Styles.isMobile ? 4 : 16,
    paddingRight: Kb.Styles.isMobile ? 4 : 16,
  },
  kbfsActions: {flexShrink: 0, justifyContent: 'flex-end'},
  kbfsCancel: {color: Kb.Styles.globalColors.red},
  kbfsJobLeft: {
    flexGrow: 1,
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
  kbfsJobRight: {flexShrink: 0},
  kbfsProgress: {
    height: Kb.Styles.globalMargins.small,
  },
  scroll: {height: '100%', width: '100%'},
}))

export default Archive
