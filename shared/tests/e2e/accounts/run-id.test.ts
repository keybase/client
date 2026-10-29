import {
  ensureRunId,
  newRunId,
  parseRunId,
  parseStampedName,
  parseStampedText,
  runIdFromEnv,
  stampedChannelName,
  stampedEmojiName,
  stampedTeamName,
} from './run-id'

const at11 = Date.UTC(2026, 9, 27, 11, 0)
const day = 24 * 60 * 60_000

test('a run id is 4 base36 minutes since 2026-01-01Z, a random base36 and a random digit', () => {
  expect(newRunId(at11, () => 0)).toBe('98qc00')
  expect(newRunId(at11 + 59_999, n => n - 1)).toBe('98qcz9')
})

test('parse round-trips to the start minute', () => {
  for (const ms of [at11, Date.UTC(2027, 5, 1, 23, 59), Date.UTC(2028, 11, 31, 0, 1)]) {
    const id = newRunId(ms + 12_345, n => n - 2)
    expect(parseRunId(id, ms)).toEqual({startMs: ms})
  }
})

test('not run ids: wrong shape, no digit at the end, or before the scheme existed', () => {
  expect(parseRunId('98qc0', at11)).toBeUndefined()
  expect(parseRunId('98QC00', at11)).toBeUndefined()
  expect(parseRunId('98qc00x', at11)).toBeUndefined()
  expect(parseRunId('98qc0a', at11)).toBeUndefined()
  expect(parseRunId('000100', at11)).toBeUndefined()
  expect(() => newRunId(Date.UTC(2025, 11, 31))).toThrow(/out of range/)
})

test('words do not parse as run ids', () => {
  const farFuture = Date.UTC(2029, 0, 1)
  for (const word of ['nojoin', 'roedit', 'closed', 'scroll', 'abcdef', 'zzzzzz']) {
    expect(parseRunId(word, farFuture)).toBeUndefined()
    expect(parseStampedName(`e2e-${word}-x`, 'dashed', farFuture)).toBeUndefined()
    expect(parseStampedName(`e2e${word}x`, 'team', farFuture)).toBeUndefined()
  }
})

test('an id more than a day ahead of now does not parse', () => {
  const tomorrow = newRunId(at11 + day, () => 1)
  const later = newRunId(at11 + day + 60_000, () => 1)
  expect(parseRunId(tomorrow, at11)).toEqual({startMs: at11 + day})
  expect(parseRunId(later, at11)).toBeUndefined()
  expect(parseStampedName(`e2e-${later}-x`, 'dashed', at11)).toBeUndefined()
})

test('names stay within the service limits, or throw', () => {
  const id = '98qc00'
  expect(stampedChannelName('abcdefghi', id, at11)).toBe('e2e-98qc00-abcdefghi')
  expect(() => stampedChannelName('abcdefghij', id, at11)).toThrow(/over 20/)
  expect(() => stampedChannelName('a*', id, at11)).toThrow(/label/)
  expect(stampedTeamName('abcdefg', id, at11)).toBe('e2e98qc00abcdefg')
  expect(() => stampedTeamName('abcdefgh', id, at11)).toThrow(/over 16/)
  expect(() => stampedTeamName('Ab', id, at11)).toThrow(/label/)
  expect(() => stampedTeamName('a__b', id, at11)).toThrow(/double underscore/)
  expect(() => stampedChannelName('a', 'nope00', at11)).toThrow(/not a run id/)
})

test('stamped names parse back to their run', () => {
  const id = newRunId(at11, () => 5)
  expect(parseStampedName(stampedChannelName('chan', id, at11), 'dashed', at11)).toEqual({runId: id, startMs: at11})
  expect(parseStampedName(stampedTeamName('grp', id, at11), 'team', at11)).toEqual({runId: id, startMs: at11})
  // seeded and older names
  expect(parseStampedName('e2eclosed', 'team', at11)).toBeUndefined()
  expect(parseStampedName('e2e-scratch', 'dashed', at11)).toBeUndefined()
  expect(parseStampedName('e2e-leave-mh3k2a1b', 'dashed', at11)).toBeUndefined()
  expect(parseStampedName(`e2e-${id}-a*`, 'dashed', at11)).toBeUndefined()
})

test('the env holds one run id, set once by the entry point', () => {
  const env: Record<string, string | undefined> = {}
  expect(runIdFromEnv(env, at11)).toBeUndefined()
  const id = ensureRunId(env, at11)
  expect(env['KB_E2E_RUN_ID']).toBe(id)
  expect(ensureRunId(env, at11 + 3_600_000)).toBe(id)
  expect(() => runIdFromEnv({KB_E2E_RUN_ID: '2610271200beef'}, at11)).toThrow(/not a run id/)
})

test('stampedEmojiName rejects labels with separators and names over 32', () => {
  const id = '98qc00'
  expect(stampedEmojiName('abcdefghijklmnopqrstu', id, at11)).toBe('e2e_98qc00_abcdefghijklmnopqrstu')
  expect(() => stampedEmojiName('abcdefghijklmnopqrstuv', id, at11)).toThrow(/over 32/)
  for (const label of ['a_b', 'a-b', 'a.b', 'A', '']) expect(() => stampedEmojiName(label, id, at11)).toThrow(/label/)
  expect(() => stampedEmojiName('a', 'nope00', at11)).toThrow(/not a run id/)
  expect(parseStampedName(stampedEmojiName('smile', id, at11), 'emoji', at11)).toEqual({runId: id, startMs: at11})
  expect(parseStampedName('e2e_98qc00_a_b', 'emoji', at11)).toBeUndefined()
  expect(parseStampedName('e2e-98qc00-a', 'emoji', at11)).toBeUndefined()
})

test('parseStampedText reads the first token only', () => {
  const id = '98qc00'
  expect(parseStampedText(`e2e-${id}-x hello`, at11)).toEqual({runId: id, startMs: at11})
  expect(parseStampedText(`e2e-${id}-x\nsecond line`, at11)).toEqual({runId: id, startMs: at11})
  expect(parseStampedText(`hello e2e-${id}-x`, at11)).toBeUndefined()
  expect(parseStampedText(` e2e-${id}-x`, at11)).toBeUndefined()
  expect(parseStampedText('e2e-scratch-pad-0001', at11)).toBeUndefined()
  expect(parseStampedText('', at11)).toBeUndefined()
})
