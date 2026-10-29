// What to do with the phone's recording once the app's JS runtime token is read again: the same
// runtime keeps its recording, a different one is a reload or relaunch that dropped it, and no
// token yet means the new runtime has not finished loading.
export const nextRecordingAction = (prev: string | undefined, now: string | undefined): 'take' | 'restart' | 'wait' =>
  now === undefined ? 'wait' : prev === undefined || prev === now ? 'take' : 'restart'
