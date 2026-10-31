// Framework-free parts of the iOS backup flow: which backup jobs a test made, what the modal's
// "Started N jobs" line says, and the paths a job writes on the phone, checked to be the simulator's
// own before the host looks at them. A path never goes in an error: in the simulator it holds this
// Mac's home folder, and a files job's staging folder holds the account's name.
import * as path from 'path'
import type {ArchiveJobStates, ArchiveJobs} from './app-ask'

// ArchiveChatJobStatus and SimpleFSArchiveJobPhase, as the phone's service answers them
export const CHAT_RUNNING = 0
export const CHAT_PAUSED = 1
export const CHAT_COMPLETE = 4
export const KBFS_DONE = 6

// The jobs in `now` that are not in `before`: the ones a test made.
export const newJobIDs = (now: ArchiveJobs, before: ArchiveJobs): ArchiveJobs => {
  const old = new Set([...before.chat, ...before.kbfs])
  return {chat: now.chat.filter(id => !old.has(id)), kbfs: now.kbfs.filter(id => !old.has(id))}
}

export const jobIDsOf = (s: ArchiveJobStates): ArchiveJobs => ({chat: s.chat.map(j => j.id), kbfs: s.kbfs.map(j => j.id)})

// The jobs of `ids` that `now` still lists.
export const stillListed = (now: ArchiveJobs, ids: ArchiveJobs) => {
  const listed = new Set([...now.chat, ...now.kbfs])
  return [...ids.chat, ...ids.kbfs].filter(id => listed.has(id)).length
}

// N of the backup modal's "Started N jobs successfully." line, or undefined for any other text.
export const startedJobsOf = (label: string) => {
  const m = /^Started (\d+) jobs successfully\.$/.exec(label.trim())
  return m ? Number(m[1]) : undefined
}

// The simulator's own storage, from the app's data container (simctl get_app_container ... data):
// the device's data folder, which holds the app's data and group containers alike.
export const simDataRoot = (appDataContainer: string) => {
  const at = appDataContainer.indexOf('/data/Containers/')
  if (!path.isAbsolute(appDataContainer) || at < 0) throw new Error("the app's data container is not a simulator's")
  return appDataContainer.slice(0, at + '/data/'.length)
}

const inside = (p: string, root: string) => path.isAbsolute(p) && path.resolve(p) === p && p.startsWith(root) && p.length > root.length

// What the jobs `ids` of `states` write on the phone: a chat job its folder and the compressed file
// beside it, a files job its staging folder and its zip (on the phone, inside the staging folder).
// Refuses a job of `ids` that `states` does not list, and a path outside `root` (simDataRoot), so the
// host only ever looks inside the simulator.
export const outputPathsOf = (states: ArchiveJobStates, ids: ArchiveJobs, root: string) => {
  const paths: Array<string> = []
  for (const id of ids.chat) {
    const j = states.chat.find(c => c.id === id)
    if (!j) throw new Error('a chat backup job of the test is not listed')
    paths.push(j.outputPath, `${j.outputPath}.tar.gzip`)
  }
  for (const id of ids.kbfs) {
    const j = states.kbfs.find(k => k.id === id)
    if (!j) throw new Error('a files backup job of the test is not listed')
    paths.push(j.stagingPath, j.zipFilePath)
  }
  if (!paths.every(p => inside(p, root))) throw new Error("refusing a backup output path outside the simulator's own storage")
  return paths
}

// Where an output's existence is anchored: the output itself, or the folder it is made in. That
// folder must lie inside `root` and not be `root` itself, so a "gone" read later means the output was
// removed from a folder the job used, not that it was looked for somewhere it never could be.
export const anchorsOf = (output: string, root: string) => {
  const parent = path.dirname(output)
  if (!inside(output, root) || !inside(parent, root)) throw new Error("refusing a backup output path outside the simulator's own storage")
  return [output, parent]
}

// The compressed file a finished chat job of `ids` left beside its folder (the service adds
// .tar.gzip once the job completes, go/chat/archive.go ArchiveChat, and its delete removes only the
// folder): one per chat job of `ids`, each inside `root`. Refuses a job `states` does not list.
export const chatArchivesOf = (states: ArchiveJobStates, ids: ArchiveJobs, root: string) =>
  ids.chat.map(id => {
    const j = states.chat.find(c => c.id === id)
    if (!j) throw new Error('a chat backup job of the test is not listed')
    const file = `${j.outputPath}.tar.gzip`
    if (!inside(file, root) || !inside(j.outputPath, root)) throw new Error("refusing a backup output path outside the simulator's own storage")
    return file
  })
