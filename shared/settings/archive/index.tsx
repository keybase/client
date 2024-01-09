import * as React from 'react'
import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {formatTimeForPopup} from '@/util/timestamp'

type JobDetails = {
  context: string
  outPath: string
  progress: number
  start: string
}

const mock = {
  1: {
    context: 'chat/.',
    outPath: '~/Downloads/all',
    progress: 0.2,
    start: formatTimeForPopup(new Date().getTime() - 1000 * 60 * 60 * 24 * 3),
  },
  2: {
    context: 'fs/.',
    outPath: '~/Downloads/fs',
    progress: 0.5,
    start: formatTimeForPopup(new Date().getTime() - 1000 * 60 * 60 * 24 * 8),
  },
  3: {
    context: 'chat/keybasefriends',
    outPath: '~/Downloads/kbf',
    progress: 1,
    start: formatTimeForPopup(new Date().getTime() - 1000 * 60 * 60 * 24 * 30),
  },
} as Record<number, JobDetails>

const Job = React.memo(function Job(p: {index: number; id: number}) {
  const {id, index} = p

  const onCancel = React.useCallback(() => {
    console.log('cancel TODO', id)
  }, [id])
  // TODO really get data
  const m = mock[id]
  if (!m) return null
  const {start, progress, outPath, context} = m
  const done = progress === 1
  return (
    <Kb.ListItem2
      firstItem={index === 0}
      type="Small"
      body={
        <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="tiny">
          <Kb.Box2 direction="vertical" style={styles.jobLeft}>
            <Kb.Text type="Body">
              Job {id}: (started: {start})
            </Kb.Text>
            <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" gap="tiny">
              <Kb.ProgressBar ratio={progress} />
              <Kb.Text type="Body">
                Archiving {context} to {outPath}
              </Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
          {done ? (
            <Kb.Text type="BodyPrimaryLink" onClick={onCancel}>
              Show in {C.fileUIName}
            </Kb.Text>
          ) : (
            <Kb.Button type="Danger" label="Cancel" onClick={onCancel} small={true} />
          )}
        </Kb.Box2>
      }
    ></Kb.ListItem2>
  )
})

const itemHeight = {
  height: 48,
  type: 'fixed',
} as const

const mockJobs = [1, 2, 3]

const Archive = () => {
  const archiveChat = React.useCallback(() => {}, [])
  const archiveFS = React.useCallback(() => {}, [])
  const clearCompleted = React.useCallback(() => {}, [])
  const jobs = mockJobs

  const showClear = React.useMemo(() => {
    return jobs.some(id => {
      return (mock[id]?.progress ?? 0) === 1
    })
  }, [jobs])

  const renderItem = React.useCallback((idx: number, id: number) => {
    return <Job id={id} key={id} index={idx} />
  }, [])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} gap="medium" style={styles.container}>
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Text type="Header">Archive</Kb.Text>
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
        <Kb.Box2 direction="vertical" style={styles.jobs} fullWidth={true}>
          {jobs.length ? (
            <>
              <Kb.Box2 direction="vertical" style={{height: jobs.length * 48}} fullWidth={true}>
                <Kb.List2 renderItem={renderItem} items={jobs} itemHeight={itemHeight} indexAsKey={true} />
              </Kb.Box2>
              {showClear ? (
                <Kb.Button label="Clear completed" onClick={clearCompleted} style={styles.clear} />
              ) : null}
            </>
          ) : (
            <Kb.Text type="Body">• No active archive jobs</Kb.Text>
          )}
        </Kb.Box2>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  clear: {alignSelf: 'flex-start', marginTop: 16},
  container: {padding: 16},
  jobLeft: {flexGrow: 1},
  jobs: {flexGrow: 1, flexShrink: 1, paddingLeft: 16, paddingRight: 16},
}))

export default Archive
