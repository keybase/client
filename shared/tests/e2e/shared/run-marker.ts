import {randomBytes} from 'crypto'
import {runIdFromEnv} from '../accounts/run-id'

// This run's id (the runner sets it before any test), which the names a flow creates carry so the
// sweeper can clear what a crashed run leaves.
export const e2eRunId = () => {
  const id = runIdFromEnv(process.env)
  if (!id) throw new Error('KB_E2E_RUN_ID is not set: the e2e runner sets it before any test')
  return id
}

// A message body or title unique to one post: `e2e-<runid>-<label>-<random>`, so its first word
// carries the run (see parseStampedText) and a repeat in the same run does not find an older post.
export const e2eMarker = (label: string) => `e2e-${e2eRunId()}-${label}-${randomBytes(4).toString('hex')}`
