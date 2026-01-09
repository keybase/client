export const requestPermissionsToWrite = async () => {
  return Promise.resolve(true)
}

export function showShareActionSheet() {
  throw new Error('Show Share Action - unsupported on this platform')
}
export async function saveAttachmentToCameraRoll() {
  return Promise.reject(new Error('Save Attachment to camera roll - unsupported on this platform'))
}

export const requestLocationPermission = async () => Promise.resolve()
export const watchPositionForMap = async () => Promise.resolve(() => {})
