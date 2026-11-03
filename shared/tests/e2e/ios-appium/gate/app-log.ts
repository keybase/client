// What the app logs through its logger (logger.info and the rest), captured inside its JS runtime and
// read over Metro's inspector: the gate's read of app log lines, never start.log or metro.log. A
// line logged before the capture was installed in a runtime is not in it, so a cold launch's lines
// are read through the recorder (startRoutes, appSnapshot) instead.
import {jsEval, waitFor} from '../helpers/lifecycle'
import {e2eMarker} from '../../shared/run-marker.ts'
import {appLogCaptureBody, appLogMarkerBody, appLogReadBody, linesBefore, readSince, type AppLogMark, type AppLogRead} from './app-log-lib.ts'

// The marker shows at once; the bound covers a slow inspector.
const MARKER_MS = 10_000

const install = async (): Promise<AppLogMark> => {
  const m = await jsEval<{runtime: string | null; seq: number}>(appLogCaptureBody)
  if (!m.runtime) throw new Error('the app has no e2e runtime id, so its log capture cannot tell a reload')
  return {runtime: m.runtime, seq: m.seq}
}

// Installs the capture into the running runtime if it has none (device.ts runs it after each launch).
export const installAppLogCapture = async (): Promise<void> => {
  await install()
}

// A mark at the end of what the app has logged, installing the capture first if needed.
export const appLogMark = async (): Promise<AppLogMark> => install()

// Every line the app logged since `mark`. Throws when the app reloaded since, or the capture dropped
// lines logged after the mark.
export const appLogSince = async (mark: AppLogMark): Promise<Array<string>> =>
  readSince(mark, await jsEval<AppLogRead>(appLogReadBody(mark.seq)))

// Logs a stamped line through the app's own logger and returns it: the positive anchor for "didn't
// happen", as a line before it was logged inside the window the capture covered.
export const appLogMarker = async (label: string): Promise<string> => {
  const marker = e2eMarker(`log-${label}`)
  await jsEval<boolean>(appLogMarkerBody(marker))
  return marker
}

// The lines logged from `mark` up to a marker logged now: a flow reads an absence from these (what
// it waits on came before the marker, or never). Throws when the marker does not show within
// MARKER_MS, as then the window was not captured.
export const appLogUntilMarker = async (mark: AppLogMark, label: string): Promise<Array<string>> => {
  const marker = await appLogMarker(label)
  return waitFor('the app log marker to show in the capture', async () => linesBefore(await appLogSince(mark), marker), {
    interval: 250,
    timeout: MARKER_MS,
  })
}
