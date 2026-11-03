import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {IOS_SURFACES, iosSurfacesExisting} from './surfaces.ts'

const plist = (keys: Array<string>, extra = '') =>
  `<plist><dict>${keys.map(k => `<key>${k}</key><string>x</string>`).join('')}${extra}</dict></plist>`
const urlSchemes = (...schemes: Array<string>) =>
  `<key>CFBundleURLTypes</key><array><dict><key>CFBundleURLSchemes</key><array>${schemes.map(s => `<string>${s}</string>`).join('')}</array></dict></array>`

const fixture = (files: Record<string, string>) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-ios-surfaces-'))
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, 'ios', f)), {recursive: true})
    fs.writeFileSync(path.join(dir, 'ios', f), text)
  }
  return dir
}

const full = {
  'Keybase/Info.plist': plist(['NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSLocationWhenInUseUsageDescription'], urlSchemes('keybase')),
  'Keybase/Keybase.entitlements': plist(['aps-environment']),
  'KeybaseShare/Info.plist': plist(['NSExtension']),
}

test('every surface exists when the app declares all of them', () => {
  expect(iosSurfacesExisting(fixture(full))).toEqual([...IOS_SURFACES])
})

test('a surface the app does not declare is not existing; those without a marker always are', () => {
  const dir = fixture({
    ...full,
    'Keybase/Info.plist': plist(['NSPhotoLibraryUsageDescription'], urlSchemes('other')),
    'Keybase/Keybase.entitlements': plist([]),
    'KeybaseShare/Info.plist': plist([]),
  })
  expect(iosSurfacesExisting(dir)).toEqual(['photo-picker', 'file-picker', 'background-foreground', 'relaunch', 'pasteboard'])
})

test('a moved plist throws', () => {
  expect(() => iosSurfacesExisting(fixture({'Keybase/Info.plist': plist([])}))).toThrow('is gone')
})
