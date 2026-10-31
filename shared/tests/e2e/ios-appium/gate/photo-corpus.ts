// Which photo corpus items each simulator's Photos library has had added (device.ts
// ensurePhotoCorpus): ~/.config/keybase-e2e/ios-photo-corpus.json, mode 600 in the mode 700 env dir,
// {<udid>: [{name, sha256}]}. Never per run: the library can't be cleaned through simctl, so an item
// is added once per simulator ever. One writer: the release lock serializes runs and wdio runs one
// worker.
import * as fs from 'fs'
import * as path from 'path'
import {e2eConfigDir} from '../../accounts/env.ts'
import {checkMode} from '../../accounts/paper-key-ledger.ts'
import type {CorpusRecordItem} from './device-lib.ts'

export type CorpusRecord = Record<string, Array<CorpusRecordItem>>

export const corpusRecordPath = () => path.join(e2eConfigDir(), 'ios-photo-corpus.json')

const udidRe = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i
const shaRe = /^[0-9a-f]{64}$/

export const readCorpusRecord = (file = corpusRecordPath()): CorpusRecord => {
  if (!fs.existsSync(file)) return {}
  checkMode(file, 0o600)
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${file} is not a record of simulators`)
  const out: CorpusRecord = {}
  for (const [udid, items] of Object.entries(parsed as Record<string, unknown>)) {
    if (!udidRe.test(udid) || !Array.isArray(items)) throw new Error(`${file} holds an entry that is not a simulator's items`)
    out[udid] = items.map((i: unknown) => {
      const {name, sha256} = (i ?? {}) as {name?: unknown; sha256?: unknown}
      if (typeof name !== 'string' || typeof sha256 !== 'string' || !shaRe.test(sha256)) throw new Error(`${file} holds an item without a name and a sha256`)
      return {name, sha256}
    })
  }
  return out
}

// Adds one item to `udid`'s entry, written whole and renamed into place.
export const recordCorpusItem = (udid: string, item: CorpusRecordItem, file = corpusRecordPath()) => {
  if (!udidRe.test(udid) || !shaRe.test(item.sha256)) throw new Error('refusing a photo corpus record without a udid and a sha256')
  const record = readCorpusRecord(file)
  const items = record[udid] ?? []
  if (items.some(i => i.sha256 === item.sha256)) return
  record[udid] = [...items, {name: item.name, sha256: item.sha256}]
  const dir = path.dirname(file)
  fs.mkdirSync(dir, {mode: 0o700, recursive: true})
  checkMode(dir, 0o700)
  const tmp = `${file}.tmp-${process.pid}`
  fs.writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`, {mode: 0o600})
  fs.chmodSync(tmp, 0o600)
  fs.renameSync(tmp, file)
}
