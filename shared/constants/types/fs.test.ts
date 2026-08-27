/// <reference types="jest" />
import * as T from '@/constants/types'

test('stringToPath normalizes repeated and trailing slashes, and rejects relative paths', () => {
  expect(T.FS.stringToPath('/keybase/private/testuser')).toBe('/keybase/private/testuser')
  expect(T.FS.stringToPath('/keybase//private///testuser')).toBe('/keybase/private/testuser')
  expect(T.FS.stringToPath('/keybase/private/testuser/')).toBe('/keybase/private/testuser')
  expect(T.FS.stringToPath('keybase/private/testuser')).toBeUndefined()
  expect(T.FS.pathToString(undefined)).toBe('')
})

test('pathConcat keeps the root special-cased and ignores empty elements', () => {
  const tlf = T.FS.stringToPath('/keybase/private/testuser')
  expect(T.FS.pathConcat(tlf, 'file.txt')).toBe('/keybase/private/testuser/file.txt')
  expect(T.FS.pathConcat(tlf, '')).toBe(tlf)
  expect(T.FS.pathConcat(T.FS.stringToPath('/'), 'keybase')).toBe('/keybase')
})

test('path element accessors agree on levels, names and parents', () => {
  const path = T.FS.stringToPath('/keybase/team/keybase/dir/file.txt')
  expect(T.FS.getPathElements(path)).toEqual(['keybase', 'team', 'keybase', 'dir', 'file.txt'])
  expect(T.FS.getPathLevel(path)).toBe(5)
  expect(T.FS.getPathName(path)).toBe('file.txt')
  expect(T.FS.getPathParent(path)).toBe('/keybase/team/keybase/dir')
  expect(T.FS.getPathDir(path)).toBe('/keybase/team/keybase/dir')
  expect(T.FS.getPathFromElements(['keybase', 'private', 'testuser'])).toBe('/keybase/private/testuser')

  expect(T.FS.getPathElements(undefined)).toEqual([])
  expect(T.FS.getPathLevel(undefined)).toBe(0)
  expect(T.FS.getPathName(undefined)).toBe('')
})

test('getPathNameFromElems returns the last element or empty', () => {
  expect(T.FS.getPathNameFromElems(['keybase', 'private', 'testuser'])).toBe('testuser')
  expect(T.FS.getPathNameFromElems([])).toBe('')
})

test('visibility is derived from the second path element only', () => {
  expect(T.FS.getPathVisibility(T.FS.stringToPath('/keybase/private/testuser'))).toBe(T.FS.TlfType.Private)
  expect(T.FS.getPathVisibility(T.FS.stringToPath('/keybase/public/testuser'))).toBe(T.FS.TlfType.Public)
  expect(T.FS.getPathVisibility(T.FS.stringToPath('/keybase/team/keybase'))).toBe(T.FS.TlfType.Team)
  expect(T.FS.getPathVisibility(T.FS.stringToPath('/keybase'))).toBeUndefined()
  expect(T.FS.getPathVisibility(T.FS.stringToPath('/keybase/bogus/x'))).toBeUndefined()
})

test('getTlfTypePathFromTlfType and getTlfTypeFromPath round-trip', () => {
  for (const tlfType of [T.FS.TlfType.Private, T.FS.TlfType.Public, T.FS.TlfType.Team]) {
    const p = T.FS.getTlfTypePathFromTlfType(tlfType)
    expect(T.FS.getTlfTypeFromPath(p)).toBe(tlfType)
  }
  expect(T.FS.getTlfTypeFromPath(T.FS.stringToPath('/keybase'))).toBeUndefined()
})

test('pathIsNonTeamTLFList is true only for the private and public list roots', () => {
  expect(T.FS.pathIsNonTeamTLFList(T.FS.stringToPath('/keybase/private'))).toBe(true)
  expect(T.FS.pathIsNonTeamTLFList(T.FS.stringToPath('/keybase/public'))).toBe(true)
  expect(T.FS.pathIsNonTeamTLFList(T.FS.stringToPath('/keybase/team'))).toBe(false)
  expect(T.FS.pathIsNonTeamTLFList(T.FS.stringToPath('/keybase/private/testuser'))).toBe(false)
})

test('getPathFromRelative builds a full kbfs path', () => {
  expect(T.FS.getPathFromRelative('testuser,testuser-mac', T.FS.TlfType.Private, 'dir/file')).toBe(
    '/keybase/private/testuser,testuser-mac/dir/file'
  )
})

test('direntToPathType maps every dirent kind', () => {
  const make = (direntType: T.RPCGen.DirentType) => ({direntType}) as T.RPCGen.Dirent
  expect(T.FS.direntToPathType(make(T.RPCGen.DirentType.dir))).toBe(T.FS.PathType.Folder)
  expect(T.FS.direntToPathType(make(T.RPCGen.DirentType.sym))).toBe(T.FS.PathType.Symlink)
  expect(T.FS.direntToPathType(make(T.RPCGen.DirentType.file))).toBe(T.FS.PathType.File)
  expect(T.FS.direntToPathType(make(T.RPCGen.DirentType.exec))).toBe(T.FS.PathType.File)
  expect(T.FS.direntToPathType(make(-1 as T.RPCGen.DirentType))).toBe(T.FS.PathType.Unknown)
})

test('stringToPathType and pathTypeToString round-trip and throw on garbage', () => {
  for (const pathType of [
    T.FS.PathType.Folder,
    T.FS.PathType.File,
    T.FS.PathType.Symlink,
    T.FS.PathType.Unknown,
  ]) {
    expect(T.FS.stringToPathType(T.FS.pathTypeToString(pathType))).toBe(pathType)
  }
  expect(() => T.FS.stringToPathType('nope')).toThrow()
})

test('rpc folder type and visibility convert both ways', () => {
  expect(T.FS.getRPCFolderTypeFromVisibility(T.FS.TlfType.Private)).toBe(T.RPCGen.FolderType.private)
  expect(T.FS.getRPCFolderTypeFromVisibility(undefined)).toBe(T.RPCGen.FolderType.unknown)
  expect(T.FS.getVisibilityFromRPCFolderType(T.RPCGen.FolderType.team)).toBe(T.FS.TlfType.Team)
  expect(T.FS.getVisibilityFromRPCFolderType(T.RPCGen.FolderType.unknown)).toBeUndefined()
})

test('local path helpers skip empty trailing elements', () => {
  expect(T.FS.getLocalPathName('/tmp/dir/file.txt')).toBe('file.txt')
  expect(T.FS.getLocalPathName('/tmp/dir/')).toBe('dir')
  expect(T.FS.getLocalPathName('file.txt')).toBe('file.txt')
  expect(T.FS.getLocalPathName('')).toBe('')
  expect(T.FS.getLocalPathName('/')).toBe('')
  expect(T.FS.getLocalPathDir('/tmp/dir/file.txt')).toBe('/tmp/dir')
  expect(T.FS.localPathConcat('/tmp/dir', 'file.txt')).toBe('/tmp/dir/file.txt')
  // non-windows: already normalized
  expect(T.FS.getNormalizedLocalPath('/tmp/dir/file.txt')).toBe('/tmp/dir/file.txt')
})
