// The app-side stop of location sharing a hook falls back to: the app's own send of `/location stop`,
// with the recorder paused, so it never credits the send.
import {jsEval} from '../helpers/lifecycle'
import {stopLocationBody} from './location-lib.ts'
import {withHarnessRpcs} from './recorder.ts'

export const stopSharingFromApp = async (convID: string) =>
  withHarnessRpcs('the location stop', async () => jsEval<boolean>(stopLocationBody(convID)))
