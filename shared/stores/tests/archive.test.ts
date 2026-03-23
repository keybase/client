/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useArchiveState} from '../archive'

const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('start enters archive-all waiting state and records the finished response', async () => {
  jest.spyOn(T.RPCGen as any, 'SimpleFSSimpleFSArchiveAllFilesRpcPromise').mockResolvedValue({
    skippedTLFPaths: ['/private/skipped'],
    tlfPathToError: {'/private/error': 'boom'},
    tlfPathToJobDesc: {'/private/job': {}},
  })

  const store = useArchiveState
  store.getState().dispatch.start('kbfs', '/keybase', '')

  expect(store.getState().archiveAllFilesResponseWaiter.state).toBe('waiting')

  await flush()

  expect(T.RPCGen.SimpleFSSimpleFSArchiveAllFilesRpcPromise).toHaveBeenCalledWith({
    includePublicReadonly: false,
    outputDir: '',
    overwriteZip: false,
  })
  expect(store.getState().archiveAllFilesResponseWaiter).toEqual({
    errors: new Map([['/private/error', 'boom']]),
    skipped: 1,
    started: 1,
    state: 'finished',
  })
})

test('engine archive status updates KBFS jobs and freshness entries', () => {
  const store = useArchiveState
  store.setState(
    {
      ...store.getState(),
      kbfsJobs: new Map(),
      kbfsJobsFreshness: new Map([
        ['job-1', 11],
        ['job-old', 4],
      ]),
    },
    true
  )

  store.getState().dispatch.onEngineIncomingImpl({
    payload: {
      params: {
        status: {
          jobs: [
            {
              bytesCopied: 10,
              bytesTotal: 20,
              bytesZipped: 30,
              desc: {
                gitRepo: undefined,
                jobID: 'job-1',
                kbfsPathWithRevision: {
                  archivedParam: {KBFSArchivedType: T.RPCGen.KBFSArchivedType.revision, revision: 7},
                  path: '/keybase/private/alice',
                },
                startTime: 123,
                zipFilePath: '/tmp/job-1.zip',
              },
              error: undefined,
              phase: T.RPCGen.SimpleFSArchiveJobPhase.done,
            },
          ],
        },
      },
    },
    type: 'keybase.1.NotifySimpleFS.simpleFSArchiveStatusChanged',
  } as any)

  expect(store.getState().kbfsJobs.get('job-1')?.phase).toBe('Done')
  expect(store.getState().kbfsJobsFreshness.get('job-1')).toBe(11)
  expect(store.getState().kbfsJobsFreshness.has('job-old')).toBe(false)
})
