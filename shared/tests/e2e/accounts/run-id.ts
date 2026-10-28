// The id of one e2e run, and the names of what the run creates.
//
// A run id is 6 base36 characters [0-9a-z]: 4 for the minute the run started, counted from
// 2026-01-01T00:00Z (zero-padded), then 1 random base36 character and 1 random digit. The digit
// at the end keeps a word (`e2e-nojoin-…`) from reading as a run id. It is set once per run in
// KB_E2E_RUN_ID.
// Names that carry it:
//   channels (and repos, emails, KBFS entries)  e2e-<runid>-<label>   a channel name is at most 20,
//                                                                     so the label is at most 9
//   teams and subteam parts                     e2e<runid><label>     a team name part is at most
//                                                                     16 of [a-z0-9_]: label up to 7
// Ids that would start before the scheme existed, or more than a day from now, are not run ids
// either.

const epochMs = Date.UTC(2026, 0, 1)
// no run id was handed out before this
const firstRunMs = Date.UTC(2026, 9, 27)
const minuteMs = 60_000
const futureSlackMs = 24 * 60 * 60_000
const runIdRe = /^[0-9a-z]{5}[0-9]$/

export const channelNameMax = 20
export const teamNamePartMax = 16

// `random(n)` is an integer in [0, n).
export const newRunId = (nowMs = Date.now(), random = (n: number) => Math.floor(Math.random() * n)) => {
  const minutes = Math.floor((nowMs - epochMs) / minuteMs)
  const stamp = minutes.toString(36)
  if (minutes < 0 || stamp.length > 4) throw new Error(`no run id for ${new Date(nowMs).toISOString()}: out of range`)
  return stamp.padStart(4, '0') + (random(36) % 36).toString(36) + String(random(10) % 10)
}

// The run's start minute in ms, or undefined when `runId` is not a run id.
export const parseRunId = (runId: string, nowMs = Date.now()): {startMs: number} | undefined => {
  if (!runIdRe.test(runId)) return undefined
  const startMs = epochMs + parseInt(runId.slice(0, 4), 36) * minuteMs
  return startMs < firstRunMs || startMs > nowMs + futureSlackMs ? undefined : {startMs}
}

// KB_E2E_RUN_ID from `env`, or undefined when unset. Throws on a value that is not a run id.
export const runIdFromEnv = (env: Readonly<Record<string, string | undefined>>, nowMs = Date.now()) => {
  const have = env['KB_E2E_RUN_ID']
  if (!have) return undefined
  if (!parseRunId(have, nowMs)) throw new Error(`KB_E2E_RUN_ID=${have} is not a run id (5 base36 characters and a digit)`)
  return have
}

// For a run's entry point, which owns `env`: KB_E2E_RUN_ID, set to a new run id first if unset.
export const ensureRunId = (env: Record<string, string | undefined>, nowMs = Date.now()) => {
  const have = runIdFromEnv(env, nowMs)
  if (have) return have
  const id = newRunId(nowMs)
  env['KB_E2E_RUN_ID'] = id
  return id
}

const requireRunId = (runId: string, nowMs: number) => {
  if (!parseRunId(runId, nowMs)) throw new Error(`${runId} is not a run id`)
  return runId
}

export const stampedChannelName = (label: string, runId: string, nowMs = Date.now()) => {
  if (!/^[A-Za-z0-9_-]+$/.test(label)) throw new Error(`channel label ${JSON.stringify(label)}: use [A-Za-z0-9_-]`)
  const name = `e2e-${requireRunId(runId, nowMs)}-${label}`
  if (name.length > channelNameMax) throw new Error(`channel name ${name} is over ${channelNameMax} characters`)
  return name
}

export const stampedTeamName = (label: string, runId: string, nowMs = Date.now()) => {
  if (!/^[a-z0-9_]+$/.test(label) || label.includes('__')) {
    throw new Error(`team label ${JSON.stringify(label)}: use [a-z0-9_], no double underscore`)
  }
  const name = `e2e${requireRunId(runId, nowMs)}${label}`
  if (name.length > teamNamePartMax) throw new Error(`team name ${name} is over ${teamNamePartMax} characters`)
  return name
}

const stampedRe = {
  // after the stamp: nothing a shell or `keybase fs` would expand as a glob
  dashed: /^e2e-([0-9a-z]{5}[0-9])-[A-Za-z0-9_.-]+$/,
  team: /^e2e([0-9a-z]{5}[0-9])[a-z0-9_]{1,7}$/,
} as const

// The run a name was made by, when it is a run-stamped name of that form.
export const parseStampedName = (name: string, form: keyof typeof stampedRe, nowMs = Date.now()) => {
  const runId = stampedRe[form].exec(name)?.[1]
  const run = runId === undefined ? undefined : parseRunId(runId, nowMs)
  return runId === undefined || !run ? undefined : {runId, startMs: run.startMs}
}
