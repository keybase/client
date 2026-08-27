/// <reference types="jest" />
import * as T from '@/constants/types'
import {
  canChat,
  escapePath,
  getChatTarget,
  getSharePathArrayDescription,
  getUploadedPath,
  getUsernamesFromPath,
  getUsernamesFromTlfName,
  hasPublicTag,
  hasSpecialFileElement,
  humanReadableFileSize,
  humanizeBytes,
  humanizeBytesOfTotal,
  isInTlf,
  isTeamPath,
  parsePath,
  pathsInSameTlf,
  rebasePathToDifferentTlf,
  splitTlfIntoUsernames,
  usernameInPath,
} from './fs'

const p = (s: string) => T.FS.stringToPath(s)

describe('parsePath', () => {
  test('the root and an empty path are the root kind', () => {
    expect(parsePath(p('/keybase'))).toEqual({kind: T.FS.PathKind.Root})
    expect(parsePath(p(''))).toEqual({kind: T.FS.PathKind.Root})
    expect(parsePath(p('/'))).toEqual({kind: T.FS.PathKind.Root})
  })

  test('an unknown top level is the root kind', () => {
    expect(parsePath(p('/keybase/nonsense/x'))).toEqual({kind: T.FS.PathKind.Root})
  })

  test('a tlf type on its own is a tlf list', () => {
    expect(parsePath(p('/keybase/private'))).toEqual({
      kind: T.FS.PathKind.TlfList,
      tlfType: T.FS.TlfType.Private,
    })
    expect(parsePath(p('/keybase/team'))).toEqual({
      kind: T.FS.PathKind.TlfList,
      tlfType: T.FS.TlfType.Team,
    })
  })

  test('a private tlf splits into writers and readers', () => {
    expect(parsePath(p('/keybase/private/testuser,testuser-mac#carol'))).toEqual({
      kind: T.FS.PathKind.GroupTlf,
      readers: ['carol'],
      tlfName: 'testuser,testuser-mac#carol',
      tlfType: T.FS.TlfType.Private,
      writers: ['testuser', 'testuser-mac'],
    })
  })

  test('readers are undefined rather than empty when there is no hash', () => {
    const parsed = parsePath(p('/keybase/public/testuser'))
    expect(parsed).toEqual({
      kind: T.FS.PathKind.GroupTlf,
      readers: undefined,
      tlfName: 'testuser',
      tlfType: T.FS.TlfType.Public,
      writers: ['testuser'],
    })
  })

  test('anything below a tlf carries the rest of the path', () => {
    expect(parsePath(p('/keybase/private/testuser/sub/file.txt'))).toEqual({
      kind: T.FS.PathKind.InGroupTlf,
      readers: undefined,
      rest: ['sub', 'file.txt'],
      tlfName: 'testuser',
      tlfType: T.FS.TlfType.Private,
      writers: ['testuser'],
    })
  })

  test('team paths carry the team name', () => {
    expect(parsePath(p('/keybase/team/keybase.core'))).toEqual({
      kind: T.FS.PathKind.TeamTlf,
      team: 'keybase.core',
      tlfName: 'keybase.core',
      tlfType: T.FS.TlfType.Team,
    })
    expect(parsePath(p('/keybase/team/keybase.core/a/b'))).toEqual({
      kind: T.FS.PathKind.InTeamTlf,
      rest: ['a', 'b'],
      team: 'keybase.core',
      tlfName: 'keybase.core',
      tlfType: T.FS.TlfType.Team,
    })
  })
})

describe('path predicates', () => {
  test('isInTlf needs more than a tlf type', () => {
    expect(isInTlf(p('/keybase'))).toBe(false)
    expect(isInTlf(p('/keybase/private'))).toBe(false)
    expect(isInTlf(p('/keybase/private/testuser'))).toBe(true)
  })

  test('hasPublicTag requires a tlf under public, not the public list itself', () => {
    expect(hasPublicTag(p('/keybase/public'))).toBe(false)
    expect(hasPublicTag(p('/keybase/public/testuser'))).toBe(true)
    expect(hasPublicTag(p('/keybase/private/testuser'))).toBe(false)
  })

  test('hasSpecialFileElement finds a .kbfs element at any depth', () => {
    expect(hasSpecialFileElement(p('/keybase/private/testuser/.kbfs_status'))).toBe(true)
    expect(hasSpecialFileElement(p('/keybase/private/testuser/.kbfs_x/a.txt'))).toBe(true)
    expect(hasSpecialFileElement(p('/keybase/private/testuser/a.txt'))).toBe(false)
  })

  test('isTeamPath is only true inside team tlfs', () => {
    expect(isTeamPath(p('/keybase/team/keybase.core'))).toBe(true)
    expect(isTeamPath(p('/keybase/team/keybase.core/a'))).toBe(true)
    // the team list root is not itself a team folder
    expect(isTeamPath(p('/keybase/team'))).toBe(false)
    expect(isTeamPath(p('/keybase/private/testuser'))).toBe(false)
    expect(isTeamPath(p('/keybase'))).toBe(false)
  })

  test('canChat is false above a tlf', () => {
    expect(canChat(p('/keybase'))).toBe(false)
    expect(canChat(p('/keybase/private'))).toBe(false)
    expect(canChat(p('/keybase/private/testuser'))).toBe(true)
    expect(canChat(p('/keybase/team/keybase.core/a/b'))).toBe(true)
  })

  test('pathsInSameTlf compares the tlf type and name', () => {
    expect(pathsInSameTlf(p('/keybase/private/testuser/a'), p('/keybase/private/testuser/b/c'))).toBe(true)
    expect(pathsInSameTlf(p('/keybase/private/testuser'), p('/keybase/public/testuser'))).toBe(false)
    expect(pathsInSameTlf(p('/keybase/private'), p('/keybase/private'))).toBe(false)
  })
})

describe('username helpers', () => {
  test('splitTlfIntoUsernames flattens writers and readers', () => {
    expect(splitTlfIntoUsernames('testuser,testuser-mac#carol')).toEqual([
      'testuser',
      'testuser-mac',
      'carol',
    ])
  })

  test('splitTlfIntoUsernames ignores a conflict suffix', () => {
    expect(splitTlfIntoUsernames('testuser,carol (conflicted copy)')).toEqual(['testuser', 'carol'])
  })

  // '' splits into [''], so a nameless tlf used to yield one blank username
  test('splitTlfIntoUsernames has no users for an empty tlf', () => {
    expect(splitTlfIntoUsernames('')).toEqual([])
    expect(splitTlfIntoUsernames(' (conflicted copy)')).toEqual([])
  })

  test('getUsernamesFromPath needs a tlf', () => {
    expect(getUsernamesFromPath(p('/keybase/private'))).toEqual([])
    expect(getUsernamesFromPath(p('/keybase/private/testuser,carol/a'))).toEqual(['testuser', 'carol'])
  })

  test('getUsernamesFromTlfName drops empty entries', () => {
    expect(getUsernamesFromTlfName('testuser,carol#')).toEqual(['testuser', 'carol'])
    expect(getUsernamesFromTlfName('testuser,,carol')).toEqual(['testuser', 'carol'])
  })

  test('usernameInPath matches whole names only', () => {
    expect(usernameInPath('testuser', p('/keybase/private/testuser,carol'))).toBe(true)
    expect(usernameInPath('test', p('/keybase/private/testuser,carol'))).toBe(false)
    expect(usernameInPath('testuser', p('/keybase/private'))).toBe(false)
  })
})

describe('getChatTarget', () => {
  test('a solo private folder is yourself', () => {
    expect(getChatTarget(p('/keybase/private/testuser'), 'testuser')).toBe('yourself')
  })

  test('a two person folder names the other person', () => {
    expect(getChatTarget(p('/keybase/private/testuser,carol'), 'testuser')).toBe('carol')
    expect(getChatTarget(p('/keybase/private/testuser#carol'), 'testuser')).toBe('carol')
  })

  test('three or more people is a group conversation', () => {
    expect(getChatTarget(p('/keybase/private/testuser,carol,dave'), 'testuser')).toBe('group conversation')
  })

  test('a solo folder that is not mine names the other person', () => {
    expect(getChatTarget(p('/keybase/private/carol'), 'testuser')).toBe('carol')
    expect(getChatTarget(p('/keybase/private/carol/sub/a.txt'), 'testuser')).toBe('carol')
  })

  test('team paths are a team conversation and the root is a plain conversation', () => {
    expect(getChatTarget(p('/keybase/team/keybase.core'), 'testuser')).toBe('team conversation')
    expect(getChatTarget(p('/keybase'), 'testuser')).toBe('conversation')
  })
})

describe('escapePath', () => {
  test('builds a keybase url and keeps the slashes', () => {
    expect(escapePath(p('/keybase/private/testuser/a/b.txt'))).toBe('keybase://private/testuser/a/b.txt')
  })

  test('escapes everything else', () => {
    expect(escapePath(p('/keybase/private/testuser/my file.txt'))).toBe(
      'keybase://private/testuser/my%20file.txt'
    )
    expect(escapePath(p('/keybase/private/testuser,carol#dave'))).toBe('keybase://private/testuser%2Ccarol%23dave')
  })
})

test('rebasePathToDifferentTlf keeps everything below the tlf', () => {
  expect(rebasePathToDifferentTlf(p('/keybase/private/testuser/a/b.txt'), p('/keybase/team/keybase.core'))).toBe(
    '/keybase/team/keybase.core/a/b.txt'
  )
})

describe('humanReadableFileSize', () => {
  test('an empty file is 0 B, and only a missing size is blank', () => {
    expect(humanReadableFileSize(0)).toBe('0 B')
    expect(humanReadableFileSize(undefined)).toBe('')
  })

  test('picks the largest binary unit that fits', () => {
    expect(humanReadableFileSize(1)).toBe('1 B')
    expect(humanReadableFileSize(1023)).toBe('1023 B')
    expect(humanReadableFileSize(1024)).toBe('1 KB')
    expect(humanReadableFileSize(1024 * 1024)).toBe('1 MB')
    expect(humanReadableFileSize(1024 ** 3)).toBe('1 GB')
    expect(humanReadableFileSize(1024 ** 4)).toBe('1 TB')
  })

  test('rounds rather than truncates', () => {
    expect(humanReadableFileSize(1024 * 1.6)).toBe('2 KB')
  })
})

describe('humanizeBytes', () => {
  test('uses bytes below a kilobyte', () => {
    expect(humanizeBytes(0, 2)).toBe('0 bytes')
    expect(humanizeBytes(1023, 2)).toBe('1023 bytes')
  })

  test('honors the decimal count', () => {
    expect(humanizeBytes(1536, 0)).toBe('2 KB')
    expect(humanizeBytes(1536, 2)).toBe('1.50 KB')
    expect(humanizeBytes(1024 ** 3 * 2.5, 1)).toBe('2.5 GB')
  })
})

describe('humanizeBytesOfTotal', () => {
  // Both numbers deliberately share the total's unit so the unit doesn't
  // change under the reader while a transfer progresses.
  test('picks the unit from the total, not the numerator', () => {
    expect(humanizeBytesOfTotal(512, 1024 * 1024)).toBe('0.00 of 1.00 MB')
    expect(humanizeBytesOfTotal(10, 100)).toBe('10 of 100 bytes')
  })
})

describe('getUploadedPath', () => {
  test('appends the local file name to the destination folder', () => {
    const dest = p('/keybase/private/testuser/dir')
    expect(getUploadedPath(dest, '/tmp/a.png')).toBe('/keybase/private/testuser/dir/a.png')
    expect(getUploadedPath(dest, '/tmp/sub/')).toBe('/keybase/private/testuser/dir/sub')
    // a bare file name has no separator at all
    expect(getUploadedPath(dest, 'a.png')).toBe('/keybase/private/testuser/dir/a.png')
  })
})

describe('getSharePathArrayDescription', () => {
  test('names a single file and counts several', () => {
    expect(getSharePathArrayDescription([])).toBe('')
    expect(getSharePathArrayDescription(['/tmp/a.png'])).toBe('a.png')
    expect(getSharePathArrayDescription(['/tmp/a.png', '/tmp/b.png'])).toBe('2 items')
  })
})
