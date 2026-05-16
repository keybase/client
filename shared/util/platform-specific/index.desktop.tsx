export const requestPermissionsToWrite = async () => {
  return Promise.resolve(true)
}

export function showShareActionSheet(_options: {filePath?: string; message?: string; mimeType: string}): Promise<void> {
  throw new Error('Show Share Action - unsupported on this platform')
}
export async function saveAttachmentToCameraRoll(_filePath: string, _mimeType: string) {
  return Promise.reject(new Error('Save Attachment to camera roll - unsupported on this platform'))
}

export const requestLocationPermission = async () => Promise.resolve()
export const watchPositionForMap = async () => Promise.resolve(() => {})
