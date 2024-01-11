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

const Archive = () => {
  const load = C.useArchiveState(s => s.dispatch.load)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)

  C.useOnMountOnce(() => {
    load()
  })

  const archiveChat = React.useCallback(() => {
    navigateAppend({props: {type: 'chatAll'}, selected: 'archiveModal'})
  }, [navigateAppend])
  const archiveFS = React.useCallback(() => {
    navigateAppend({props: {type: 'fsAll'}, selected: 'archiveModal'})
  }, [navigateAppend])
  const clearCompleted = C.useArchiveState(s => s.dispatch.clearCompleted)

  const jobMap = C.useArchiveState(s => s.jobs)
  const jobs = React.useMemo(() => [...jobMap.keys()], [jobMap])

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
              Easily archive your keybase data by choosing 'archive' from menus in chat and KBFS or click to
              archive all.
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
  scroll: {height: '100%', width: '100%'},
}))

export default Archive
