import {CHAT_PAUSED, anchorsOf, chatArchivesOf, chatFolderToRemove, jobIDsOf, newJobIDs, outputPathsOf, simDataRoot, stillListed} from './archive-lib'

const root = '/Users/testuser/Library/Developer/CoreSimulator/Devices/D1/data/'
const container = `${root}Containers/Data/Application/A1`

test("a test's jobs are the ones its snapshot did not have", () => {
  expect(newJobIDs({chat: ['c1', 'c2'], kbfs: ['k1', 'k2']}, {chat: ['c1'], kbfs: ['k2']})).toEqual({chat: ['c2'], kbfs: ['k1']})
  expect(newJobIDs({chat: [], kbfs: []}, {chat: ['c1'], kbfs: []})).toEqual({chat: [], kbfs: []})
  expect(stillListed({chat: ['c1'], kbfs: ['k1']}, {chat: ['c1', 'c9'], kbfs: ['k1']})).toBe(2)
  expect(stillListed({chat: ['c1'], kbfs: []}, {chat: ['c9'], kbfs: ['k9']})).toBe(0)
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

test("an output is anchored by itself, the folder it is made in or that folder's folder, all inside the simulator", () => {
  const out = `${container}/Library/Caches/kbchat-c1`
  expect(anchorsOf(out, root)).toEqual([out, `${container}/Library/Caches`, `${container}/Library`])
  // a files job's zip inside a staging folder not made yet: the staging folder's own folder anchors it
  expect(anchorsOf(`${root}x/stage/a.zip`, root)).toEqual([`${root}x/stage/a.zip`, `${root}x/stage`, `${root}x`])
  // a folder right under the storage root is the root's own child, still inside it
  expect(anchorsOf(`${root}x/y`, root)).toEqual([`${root}x/y`, `${root}x`])
  for (const bad of [`${root}x`, '/tmp/kbchat', `${root}../x/y`]) expect(() => anchorsOf(bad, root)).toThrow(/^refusing /)
})

test("a finished chat job's compressed file is found for the test's chat jobs only, inside the simulator", () => {
  const states = {
    chat: [
      {id: 'c1', outputPath: `${container}/Library/Caches/kbchat-c1`, status: 4},
      {id: 'c2', outputPath: `${container}/Library/Caches/kbchat-c2`, status: 4},
    ],
    kbfs: [],
  }
  expect(chatArchivesOf(states, {chat: ['c2'], kbfs: []}, root)).toEqual([`${container}/Library/Caches/kbchat-c2.tar.gzip`])
  expect(chatArchivesOf(states, {chat: [], kbfs: ['k1']}, root)).toEqual([])
  expect(() => chatArchivesOf(states, {chat: ['c9'], kbfs: []}, root)).toThrow(/not listed/)
  const err = (() => {
    try {
      chatArchivesOf({chat: [{id: 'c1', outputPath: '/Users/testuser/Downloads/kbchat-c1', status: 4}], kbfs: []}, {chat: ['c1'], kbfs: []}, root)
    } catch (e) {
      return e as Error
    }
    return undefined
  })()
  expect(err?.message).toMatch(/^refusing /)
  expect(err?.message).not.toContain('testuser')
})

test("a chat job's leftover folder is deleted only as that job's kbchat folder in the app's own caches", () => {
  const caches = `${container}/Library/Caches`
  const states = (outputPath: string) => ({chat: [{id: 'c1-ab', outputPath, status: CHAT_PAUSED}], kbfs: []})
  expect(chatFolderToRemove(states(`${caches}/Keybase/kbchat-c1-ab`), 'c1-ab', container)).toBe(`${caches}/Keybase/kbchat-c1-ab`)
  expect(chatFolderToRemove(states(`${caches}/kbchat-c1-ab`), 'c1-ab', container)).toBe(`${caches}/kbchat-c1-ab`)
  expect(chatFolderToRemove(states(`${caches}/Keybase/kbchat-c1-ab`), 'c9', container)).toBeUndefined()
  for (const bad of [
    // the caches root, the data root, another app's container, another job's folder
    caches,
    `${caches}/Keybase`,
    root,
    `${root}Containers/Data/Application/OTHER/Library/Caches/Keybase/kbchat-c1-ab`,
    `${caches}/Keybase/kbchat-c2`,
    `${caches}/Keybase/kbchat-c1-ab/inner`,
    `${caches}/Other/kbchat-c1-ab`,
    `${caches}/Keybase/x/kbchat-c1-ab`,
    `${caches}/Keybase/../kbchat-c1-ab/../..`,
    '',
    'kbchat-c1-ab',
  ]) {
    const err = (() => {
      try {
        chatFolderToRemove(states(bad), 'c1-ab', container)
      } catch (e) {
        return e as Error
      }
      return undefined
    })()
    expect(err?.message).toMatch(/refusing/)
    if (bad) expect(err?.message).not.toContain(bad)
  }
  expect(() => chatFolderToRemove(states(`${caches}/Keybase/kbchat-c1-ab`), 'c1-ab', '/tmp/somewhere')).toThrow(/not a simulator's/)
})
