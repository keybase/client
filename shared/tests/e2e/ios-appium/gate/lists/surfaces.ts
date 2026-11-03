import * as fs from 'fs'
import * as path from 'path'

// The app's native surfaces, which have no route. A flow credits one with creditSurface once it has
// driven it and asserted the app used it: gate/device.ts's and gate/system-ui.ts's helpers deliver
// (a link, a push, a location, pasteboard text, a relaunch, a background and foreground) and credit
// nothing.
export const IOS_SURFACES = [
  'share-extension',
  'push-notification',
  'deep-link',
  'photo-picker',
  'file-picker',
  'camera',
  'location',
  'background-foreground',
  'relaunch',
  'pasteboard',
] as const

export type IosSurface = (typeof IOS_SURFACES)[number]

const read = (sharedDir: string, file: string) => {
  const p = path.join(sharedDir, 'ios', file)
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    throw new Error(`${p} is gone: update iosSurfacesExisting to find the app's surfaces`)
  }
}

const hasKey = (plist: string, key: string) => plist.includes(`<key>${key}</key>`)

// Each marker is the app's own declaration of the surface. file-picker, background-foreground,
// relaunch and pasteboard have no native declaration to read, so they always count as existing.
// A plist that still exists but renamed or moved a key (not the file) makes its surface silently
// count as not existing: only a missing file throws.
const markers: Record<IosSurface, ((sharedDir: string) => boolean) | undefined> = {
  'background-foreground': undefined,
  camera: d => hasKey(read(d, 'Keybase/Info.plist'), 'NSCameraUsageDescription'),
  'deep-link': d => {
    const schemes = /<key>CFBundleURLSchemes<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(read(d, 'Keybase/Info.plist'))
    return !!schemes?.[1]?.includes('<string>keybase</string>')
  },
  'file-picker': undefined,
  location: d => hasKey(read(d, 'Keybase/Info.plist'), 'NSLocationWhenInUseUsageDescription'),
  pasteboard: undefined,
  'photo-picker': d => hasKey(read(d, 'Keybase/Info.plist'), 'NSPhotoLibraryUsageDescription'),
  'push-notification': d => hasKey(read(d, 'Keybase/Keybase.entitlements'), 'aps-environment'),
  relaunch: undefined,
  'share-extension': d => hasKey(read(d, 'KeybaseShare/Info.plist'), 'NSExtension'),
}

// The listed surfaces the app has, read from its Info.plist, entitlements and share extension under
// `<sharedDir>/ios`; throws when one of those files moved.
export const iosSurfacesExisting = (sharedDir: string): Array<string> =>
  IOS_SURFACES.filter(s => markers[s]?.(sharedDir) ?? true)
