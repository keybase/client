// Which photo corpus items each simulator's Photos library has had added (device.ts
// ensurePhotoCorpus): ~/.config/keybase-e2e/ios-photo-corpus.json, mode 600 in the mode 700 env dir,
// {<udid>: {data, items: [{name, sha256}]}}. Never per run: the library can't be cleaned through
// simctl, so an item is added once per simulator data ever. One writer: the release lock serializes
// runs and wdio runs one worker.
import * as fs from 'fs'
import * as path from 'path'
import {e2eConfigDir} from '../../accounts/env.ts'
import {checkMode} from '../../accounts/run-record.ts'
import type {CorpusEntry, CorpusRecordItem} from './device-lib.ts'

export type CorpusRecord = Record<string, CorpusEntry>


export const corpusRecordPath = () => path.join(e2eConfigDir(), 'ios-photo-corpus.json')

const udidRe = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i
const shaRe = /^[0-9a-f]{64}$/

export const readCorpusRecord = (file = corpusRecordPath()): CorpusRecord => {
  if (!fs.existsSync(file)) return {}
  checkMode(file, 0o600)
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${file} is not a record of simulators`)
  const out: CorpusRecord = {}
  for (const [udid, entry] of Object.entries(parsed as Record<string, unknown>)) {
    const {data, items} = (entry ?? {}) as {data?: unknown; items?: unknown}
    if (!udidRe.test(udid) || typeof data !== 'number' || !Array.isArray(items)) throw new Error(`${file} holds an entry that is not a simulator's data and items`)
    out[udid] = {
      data,
      items: items.map((i: unknown) => {
        const {name, sha256} = (i ?? {}) as {name?: unknown; sha256?: unknown}
        if (typeof name !== 'string' || typeof sha256 !== 'string' || !shaRe.test(sha256)) throw new Error(`${file} holds an item without a name and a sha256`)
        return {name, sha256}
      }),
    }
  }
  return out
}

// Adds one item to `udid`'s entry for its data `data`, written whole and renamed into place. An entry
// recorded for other data (an erased simulator) is replaced.
export const recordCorpusItem = (udid: string, data: number, item: CorpusRecordItem, file = corpusRecordPath()) => {
  if (!udidRe.test(udid) || !Number.isFinite(data) || !shaRe.test(item.sha256)) throw new Error('refusing a photo corpus record without a udid, its data and a sha256')
  const record = readCorpusRecord(file)
  const old = record[udid]
  const items = old?.data === data ? old.items : []
  if (items.some(i => i.sha256 === item.sha256)) return
  record[udid] = {data, items: [...items, {name: item.name, sha256: item.sha256}]}
  const dir = path.dirname(file)
  fs.mkdirSync(dir, {mode: 0o700, recursive: true})
  checkMode(dir, 0o700)
  const tmp = `${file}.tmp-${process.pid}`
  fs.writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`, {mode: 0o600})
  fs.chmodSync(tmp, 0o600)
  fs.renameSync(tmp, file)
}
