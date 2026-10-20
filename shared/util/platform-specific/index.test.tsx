/// <reference types="jest" />
const mockPlatform = {isAndroidPreQ: false}
const mockPerm = {request: jest.fn()}
const mockMedia = {requestPermissionsAsync: jest.fn(), createAsset: jest.fn()}
const mockKb = {
  addNotificationRequest: jest.fn(),
  androidOpenFile: jest.fn(),
  androidSaveToDownloads: jest.fn(),
}

jest.mock('react-native', () => ({
  __esModule: true,
  ActionSheetIOS: {},
  PermissionsAndroid: {
    PERMISSIONS: {WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE'},
    RESULTS: {DENIED: 'denied', GRANTED: 'granted'},
    request: (...a: Array<unknown>) => mockPerm.request(...a),
  },
}))
// jest.config maps every native-only package to one stub file, so a per-package
// jest.mock would overwrite its siblings; mock that shared file once instead.
jest.mock('../../test/mocks/native-module.js', () => ({
  __esModule: true,
  Asset: {create: (...a: Array<unknown>) => mockMedia.createAsset(...a)},
  File: class {
    delete() {}
  },
  addNotificationRequest: (...a: Array<unknown>) => mockKb.addNotificationRequest(...a),
  androidOpenFile: (...a: Array<unknown>) => mockKb.androidOpenFile(...a),
  androidSaveToDownloads: (...a: Array<unknown>) => mockKb.androidSaveToDownloads(...a),
  androidShare: jest.fn(),
  androidShareText: jest.fn(),
  iosShareFile: jest.fn(),
  requestPermissionsAsync: (...a: Array<unknown>) => mockMedia.requestPermissionsAsync(...a),
}))
jest.mock('@/logger', () => ({__esModule: true, default: {debug: jest.fn(), info: jest.fn(), warn: jest.fn()}}))
jest.mock('@/constants/platform', () => ({
  get isAndroidPreQ() {
    return mockPlatform.isAndroidPreQ
  },
}))

const g = globalThis as unknown as {isMobile: boolean; isAndroid: boolean; isIOS: boolean}

const load = (isAndroidPreQ: boolean) => {
  mockPlatform.isAndroidPreQ = isAndroidPreQ
  return PlatformSpecific
}

beforeEach(() => {
  g.isMobile = true
  g.isAndroid = true
  g.isIOS = false
  mockPerm.request.mockReset().mockResolvedValue('granted')
  mockMedia.requestPermissionsAsync.mockReset().mockResolvedValue({granted: true})
  mockMedia.createAsset.mockReset().mockResolvedValue(undefined)
  mockKb.addNotificationRequest.mockReset().mockResolvedValue(undefined)
  mockKb.androidOpenFile.mockReset().mockResolvedValue(undefined)
  mockKb.androidSaveToDownloads.mockReset().mockResolvedValue('content://downloads/1')
})

afterEach(() => {
  g.isMobile = false
  g.isAndroid = false
  g.isIOS = false
})

import * as PlatformSpecific from './index'

test('requestPermissionsToWrite on Android 10+ resolves without prompting', async () => {
  const {requestPermissionsToWrite} = load(false)
  await requestPermissionsToWrite()
  expect(mockPerm.request).not.toHaveBeenCalled()
  expect(mockMedia.requestPermissionsAsync).not.toHaveBeenCalled()
})

test('requestPermissionsToWrite before Android 10 asks for WRITE_EXTERNAL_STORAGE', async () => {
  const {requestPermissionsToWrite} = load(true)
  await requestPermissionsToWrite()
  expect(mockPerm.request).toHaveBeenCalledWith('android.permission.WRITE_EXTERNAL_STORAGE')
  mockPerm.request.mockResolvedValue('denied')
  await expect(requestPermissionsToWrite()).rejects.toThrow('Unable to acquire storage permissions')
})

test('saveFileToDownloads passes path, filename, mime and deleteSource true', async () => {
  const {saveFileToDownloads} = load(false)
  await expect(saveFileToDownloads('/cache/a.pdf', 'a.pdf', 'application/pdf')).resolves.toBe(
    'content://downloads/1'
  )
  expect(mockKb.androidSaveToDownloads).toHaveBeenCalledWith({
    deleteSource: true,
    filename: 'a.pdf',
    mime: 'application/pdf',
    path: '/cache/a.pdf',
  })
})

test('saveFileToDownloads requests write permission first on Android before 10', async () => {
  const {saveFileToDownloads} = load(true)
  mockPerm.request.mockResolvedValue('denied')
  await expect(saveFileToDownloads('/cache/a.pdf', 'a.pdf', 'application/pdf')).rejects.toThrow(
    'Unable to acquire storage permissions'
  )
  expect(mockKb.androidSaveToDownloads).not.toHaveBeenCalled()
})

test('saveFileToDownloads failure posts a local notification and rethrows', async () => {
  const {saveFileToDownloads} = load(false)
  mockKb.androidSaveToDownloads.mockRejectedValue(new Error('boom'))
  await expect(saveFileToDownloads('/cache/a.pdf', 'a.pdf', 'application/pdf')).rejects.toThrow('boom')
  expect(mockKb.addNotificationRequest).toHaveBeenCalledWith(
    expect.objectContaining({body: 'Failed to save a.pdf to Downloads'})
  )
})

test('openSavedFile wraps androidOpenFile', async () => {
  const {openSavedFile} = load(false)
  await openSavedFile('content://downloads/1', 'application/pdf')
  expect(mockKb.androidOpenFile).toHaveBeenCalledWith({mime: 'application/pdf', uri: 'content://downloads/1'})
})

test('saveAttachmentToCameraRoll on Android 10+ never requests permission', async () => {
  const {saveAttachmentToCameraRoll} = load(false)
  await saveAttachmentToCameraRoll('/cache/a.jpg', 'image/jpeg')
  expect(mockPerm.request).not.toHaveBeenCalled()
  expect(mockMedia.requestPermissionsAsync).not.toHaveBeenCalled()
  expect(mockMedia.createAsset).toHaveBeenCalledWith('file:///cache/a.jpg')
})
