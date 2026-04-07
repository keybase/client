/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useArchiveState} from '../archive'

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

test('engine archive status updates KBFS jobs', () => {
  const store = useArchiveState
  store.setState(
    {
      ...store.getState(),
      kbfsJobs: new Map(),
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
})
