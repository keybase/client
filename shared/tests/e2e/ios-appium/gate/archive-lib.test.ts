import {CHAT_PAUSED, jobIDsOf, newJobIDs, outputPathsOf, simDataRoot, startedJobsOf, stillListed} from './archive-lib'

const root = '/Users/testuser/Library/Developer/CoreSimulator/Devices/D1/data/'
const container = `${root}Containers/Data/Application/A1`

test("a test's jobs are the ones its snapshot did not have", () => {
  expect(newJobIDs({chat: ['c1', 'c2'], kbfs: ['k1', 'k2']}, {chat: ['c1'], kbfs: ['k2']})).toEqual({chat: ['c2'], kbfs: ['k1']})
  expect(newJobIDs({chat: [], kbfs: []}, {chat: ['c1'], kbfs: []})).toEqual({chat: [], kbfs: []})
  expect(stillListed({chat: ['c1'], kbfs: ['k1']}, {chat: ['c1', 'c9'], kbfs: ['k1']})).toBe(2)
  expect(stillListed({chat: ['c1'], kbfs: []}, {chat: ['c9'], kbfs: ['k9']})).toBe(0)
})

test('the started line reads its count, and nothing else does', () => {
  expect(startedJobsOf('Started 3 jobs successfully.')).toBe(3)
  expect(startedJobsOf('Started 0 jobs successfully.')).toBe(0)
  expect(startedJobsOf('Skipped 3 folders.')).toBeUndefined()
  expect(startedJobsOf('Started 3 jobs successfully. and more')).toBeUndefined()
})

test("the simulator's storage is the device's data folder, and anything else is refused", () => {
  expect(simDataRoot(container)).toBe(root)
  expect(() => simDataRoot('/tmp/somewhere')).toThrow(/not a simulator's/)
  expect(() => simDataRoot('relative/data/Containers/x')).toThrow(/not a simulator's/)
})

test("a job's outputs are its paths inside the simulator, and a path outside it is refused naming none", () => {
  const states = {
    chat: [{id: 'c1', outputPath: `${container}/Library/Caches/kbchat-c1`, status: CHAT_PAUSED}],
    kbfs: [{id: 'k1', phase: 3, stagingPath: `${root}Containers/Shared/AppGroup/G/s1`, zipFilePath: `${root}Containers/Shared/AppGroup/G/s1/x.zip`}],
  }
  expect(jobIDsOf(states)).toEqual({chat: ['c1'], kbfs: ['k1']})
  expect(outputPathsOf(states, {chat: ['c1'], kbfs: ['k1']}, root)).toEqual([
    `${container}/Library/Caches/kbchat-c1`,
    `${container}/Library/Caches/kbchat-c1.tar.gzip`,
    `${root}Containers/Shared/AppGroup/G/s1`,
    `${root}Containers/Shared/AppGroup/G/s1/x.zip`,
  ])
  expect(outputPathsOf(states, {chat: [], kbfs: []}, root)).toEqual([])
  expect(() => outputPathsOf(states, {chat: ['c9'], kbfs: []}, root)).toThrow(/not listed/)
  for (const bad of ['/Users/testuser/Downloads/kbchat', `${root}../../escape`, '', root.slice(0, -1)]) {
    const err = (() => {
      try {
        outputPathsOf({...states, chat: [{...states.chat[0]!, outputPath: bad}]}, {chat: ['c1'], kbfs: []}, root)
      } catch (e) {
        return e as Error
      }
      return undefined
    })()
    expect(err?.message).toMatch(/^refusing a backup output path outside/)
    expect(err?.message).not.toContain('testuser')
  }
})
