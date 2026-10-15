/** @jest-environment jsdom */
/// <reference types="jest" />
import * as PlatformSpecific from '@/util/platform-specific'
import * as T from '@/constants/types'
import {act, cleanup, renderHook} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {
  darwinFuseStatusToDriverStatus,
  fuseStatusToDriverStatus,
  otherFuseStatusToDriverStatus,
  saveFinishedDownloadToPublicDownloads,
  useSavedDownload,
} from './fs-platform'
import * as Constants from '@/constants/fs'

describe('android downloads', () => {
  const g = globalThis as unknown as {isMobile: boolean; isAndroid: boolean}

  const dlState = {canceled: false, done: true, endEstimate: 0, error: '', localPath: '/cache/a.pdf', progress: 1} as T.FS.DownloadState
  const dlInfo = {filename: 'a.pdf'} as T.FS.DownloadInfo

  const redbar = jest.fn()

  beforeEach(() => {
    redbar.mockReset()
    g.isMobile = true
    g.isAndroid = true
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    resetAllStores()
    g.isMobile = false
    g.isAndroid = false
    jest.restoreAllMocks()
  })

  test('a finished download is saved once per download id', async () => {
    const save = jest.spyOn(PlatformSpecific, 'saveFileToDownloads').mockResolvedValue('content://dl/1')
    await saveFinishedDownloadToPublicDownloads('id1', dlState, dlInfo, 'application/pdf', redbar)
    await saveFinishedDownloadToPublicDownloads('id1', dlState, dlInfo, 'application/pdf', redbar)
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('/cache/a.pdf', 'a.pdf', 'application/pdf')
  })

  test('a failed save raises a redbar', async () => {
    jest.spyOn(PlatformSpecific, 'saveFileToDownloads').mockRejectedValue(new Error('nope'))
    await saveFinishedDownloadToPublicDownloads('id2', dlState, dlInfo, 'application/pdf', redbar)
    expect(redbar).toHaveBeenCalledWith(`Couldn't save a.pdf to Downloads: nope`)
  })

  test('useSavedDownload updates when the save resolves', async () => {
    let resolve: (u: string) => void = () => {}
    jest.spyOn(PlatformSpecific, 'saveFileToDownloads').mockReturnValue(new Promise(_resolve => (resolve = _resolve)))
    const {result} = renderHook(() => useSavedDownload('id3'))
    const p = saveFinishedDownloadToPublicDownloads('id3', dlState, dlInfo, 'application/pdf', redbar)
    expect(result.current).toBeUndefined()
    await act(async () => {
      resolve('content://dl/3')
      await p
    })
    expect(result.current).toEqual({mime: 'application/pdf', uri: 'content://dl/3'})
  })

  test('signing out clears saved uris', async () => {
    jest.spyOn(PlatformSpecific, 'saveFileToDownloads').mockResolvedValue('content://dl/4')
    const {result} = renderHook(() => useSavedDownload('id4'))
    await act(async () => {
      await saveFinishedDownloadToPublicDownloads('id4', dlState, dlInfo, 'application/pdf', redbar)
    })
    expect(result.current).toEqual({mime: 'application/pdf', uri: 'content://dl/4'})
    act(() => {
      resetAllStores()
    })
    expect(result.current).toBeUndefined()
  })
})

describe('fuse status', () => {
  const mount: T.RPCGen.FuseMountInfo = {
    fstype: 'macfuse',
    output: 'kbfs@macfuse0 on /Volumes/Keybase (testuser) (macfuse, nodev, nosuid, synchronous)',
    path: '/Volumes/Keybase (testuser)',
  }

  const makeStatus = (overrides: Partial<T.RPCGen.FuseStatus>): T.RPCGen.FuseStatus => ({
    bundleVersion: '',
    installAction: T.RPCGen.InstallAction.none,
    installStatus: T.RPCGen.InstallStatus.installed,
    kextID: '',
    kextStarted: false,
    mountInfos: null,
    path: '/Library/Filesystems/macfuse.fs',
    status: {code: 0, desc: '', fields: null, name: 'OK'},
    version: '5.4.0',
    ...overrides,
  })

  // the darwin rows of the service's FuseStatus
  const notInstalled = makeStatus({
    installAction: T.RPCGen.InstallAction.install,
    installStatus: T.RPCGen.InstallStatus.notInstalled,
    path: '',
    version: '',
  })
  const unreadableVersion = makeStatus({
    installAction: T.RPCGen.InstallAction.reinstall,
    installStatus: T.RPCGen.InstallStatus.error,
    status: {code: 218, desc: 'Error reading the macFUSE version: bad plist', fields: null, name: 'INSTALL_ERROR'},
    version: '',
  })
  const kextInfoError = makeStatus({
    installStatus: T.RPCGen.InstallStatus.error,
    status: {code: 218, desc: 'Error loading kext info: no kext', fields: null, name: 'INSTALL_ERROR'},
  })
  const unknown = makeStatus({installStatus: T.RPCGen.InstallStatus.unknown})
  const outdated = makeStatus({installAction: T.RPCGen.InstallAction.upgrade, version: '4.8.0'})
  const unsupportedMacos = makeStatus({
    installAction: T.RPCGen.InstallAction.upgrade,
    status: {
      code: 0,
      desc: 'macFUSE 5.4.0 does not support macOS 28. Update it from https://macfuse.io',
      fields: [{key: 'macosVersion', value: '28'}],
      name: 'MACOS_UNSUPPORTED',
    },
  })
  const readyNotLoaded = makeStatus({})
  const readyLoaded = makeStatus({kextID: 'io.macfuse.filesystems.macfuse.25', kextStarted: true})

  const disabled = (macfuse: T.FS.MacfuseState, macfuseVersion = '', macfuseError = '') => ({
    ...Constants.emptyDriverStatusDisabled,
    macfuse,
    macfuseError,
    macfuseVersion,
  })

  test('darwin rows without a KBFS mount map to the macFUSE state', () => {
    expect(darwinFuseStatusToDriverStatus(notInstalled)).toEqual(disabled(T.FS.MacfuseState.NotInstalled))
    // an installed but unusable macFUSE carries the service's reason instead of asking for an install
    expect(darwinFuseStatusToDriverStatus(unreadableVersion)).toEqual(
      disabled(T.FS.MacfuseState.Error, '', 'Error reading the macFUSE version: bad plist')
    )
    expect(darwinFuseStatusToDriverStatus(kextInfoError)).toEqual(
      disabled(T.FS.MacfuseState.Error, '', 'Error loading kext info: no kext')
    )
    expect(darwinFuseStatusToDriverStatus(unknown)).toEqual(disabled(T.FS.MacfuseState.NotInstalled))
    expect(darwinFuseStatusToDriverStatus(outdated)).toEqual(disabled(T.FS.MacfuseState.Outdated, '4.8.0'))
    expect(darwinFuseStatusToDriverStatus(unsupportedMacos)).toEqual({
      ...disabled(T.FS.MacfuseState.UnsupportedMacos, '5.4.0'),
      macosVersion: '28',
    })
    expect(darwinFuseStatusToDriverStatus(readyNotLoaded)).toEqual(disabled(T.FS.MacfuseState.Ready))
    // a loaded kext alone does not mean KBFS is mounted
    expect(darwinFuseStatusToDriverStatus(readyLoaded)).toEqual(disabled(T.FS.MacfuseState.Ready))
  })

  test('darwin is Enabled exactly when the KBFS mount is listed, whatever the macFUSE row', () => {
    for (const status of [
      notInstalled,
      unreadableVersion,
      kextInfoError,
      unknown,
      outdated,
      unsupportedMacos,
      readyNotLoaded,
      readyLoaded,
    ]) {
      expect(darwinFuseStatusToDriverStatus({...status, mountInfos: [mount]})).toEqual(
        Constants.emptyDriverStatusEnabled
      )
      expect(darwinFuseStatusToDriverStatus({...status, mountInfos: []}).type).toBe(
        T.FS.DriverStatusType.Disabled
      )
    }
  })

  test('the test platform is darwin, so the entry point takes the darwin mapping', () => {
    expect(fuseStatusToDriverStatus({...readyLoaded, mountInfos: null}).type).toBe(T.FS.DriverStatusType.Disabled)
    expect(fuseStatusToDriverStatus({...readyNotLoaded, mountInfos: [mount]}).type).toBe(
      T.FS.DriverStatusType.Enabled
    )
    expect(fuseStatusToDriverStatus(undefined)).toBe(Constants.defaultDriverStatus)
  })

  test('windows keeps reading kextStarted, the upgrade action and the uninstall string', () => {
    const dokan = makeStatus({
      installAction: T.RPCGen.InstallAction.upgrade,
      kextStarted: true,
      status: {code: 0, desc: '', fields: [{key: 'uninstallString', value: 'C:\\dokan\\uninstall.exe'}], name: 'OK'},
    })
    expect(otherFuseStatusToDriverStatus(dokan, true)).toEqual({
      ...Constants.emptyDriverStatusEnabled,
      dokanOutdated: true,
      dokanUninstallExecPath: 'C:\\dokan\\uninstall.exe',
    })
    expect(otherFuseStatusToDriverStatus({...dokan, kextStarted: false}, true)).toEqual(
      Constants.emptyDriverStatusDisabled
    )
  })

  test('linux reads kextStarted and never an uninstall string', () => {
    const linux = makeStatus({
      kextStarted: true,
      status: {code: 0, desc: '', fields: [{key: 'uninstallString', value: 'x'}], name: 'OK'},
    })
    expect(otherFuseStatusToDriverStatus(linux, false)).toEqual(Constants.emptyDriverStatusEnabled)
    expect(otherFuseStatusToDriverStatus(makeStatus({}), false)).toEqual(Constants.emptyDriverStatusDisabled)
  })
})
