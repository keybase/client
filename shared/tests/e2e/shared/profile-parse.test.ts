import {parseLookup, parsePicLookup, parseSigsList, parseUpkPgpKeys, pgpEmailsByFingerprint, type Upk} from './profile-parse'

const who = 'the second account'
const fp = 'ab'.repeat(20)
const pastFp = 'cd'.repeat(20)
const device = {d1: {base: {kid: '0120d'}}}
const upk = (over: Partial<NonNullable<Upk['current']>> = {}): Upk => ({
  current: {
    deviceKeys: device,
    pgpKeys: {k1: {base: {kid: '0101a', revocation: {}}, fingerprint: Buffer.from(fp, 'hex'), identities: [{email: 'a@example.com'}]}},
    username: 'testuser-mac',
    ...over,
  },
  pastIncarnations: [{pgpKeys: {k0: {base: {kid: '0101b'}, fingerprint: pastFp.toUpperCase(), identities: [{email: 'b@example.com'}]}}}],
})

test('parseLookup needs a uid and names the account by its role only', () => {
  expect(parseLookup(JSON.stringify({them: {id: 'u1'}}), who).id).toBe('u1')
  expect(() => parseLookup(JSON.stringify({them: {}}), who)).toThrow('user/lookup returned no uid for the second account')
})

test('parseSigsList needs the eldest link', () => {
  const sigs = parseSigsList(JSON.stringify([{sig_id: 's1', type: 'eldest'}, {revoked: true, sig_id: 's2', statement: 'dns://x', type: 'proof'}]), who)
  expect(sigs[1]).toEqual({ctime: 0, revoked: true, sigID: 's2', statement: 'dns://x', type: 'proof'})
  expect(() => parseSigsList('[]', who)).toThrow(/no eldest link/)
  expect(() => parseSigsList('{}', who)).toThrow(/not a list/)
})

test('parseUpkPgpKeys reads the current keys, revoked ones too, and needs the user and a live device key', () => {
  expect(parseUpkPgpKeys(upk(), 'testuser-mac', who)).toEqual([{emails: ['a@example.com'], fingerprint: fp, kid: '0101a', revoked: true}])
  expect(() => parseUpkPgpKeys(upk(), 'testuser', who)).toThrow(/no live device key/)
  expect(() => parseUpkPgpKeys(upk({deviceKeys: {d1: {base: {revocation: {}}}}}), 'testuser-mac', who)).toThrow(/no live device key/)
})

test('pgpEmailsByFingerprint names every key the sigchain ever held, past incarnations included', () => {
  expect(pgpEmailsByFingerprint(upk())).toEqual(
    new Map([
      [pastFp, ['b@example.com']],
      [fp, ['a@example.com']],
    ])
  )
})

test('parsePicLookup reads the one square_192 url, an empty one as no avatar, and refuses any other answer', () => {
  const ok = (pictures: unknown) => JSON.stringify({pictures, status: {code: 0, name: 'OK'}})
  expect(parsePicLookup(ok([{square_192: 'https://s3.amazonaws.com/x_192_192.jpg'}]))).toBe('https://s3.amazonaws.com/x_192_192.jpg')
  expect(parsePicLookup(ok([{square_192: ''}]))).toBe('')
  expect(() => parsePicLookup(JSON.stringify({pictures: [{square_192: ''}], status: {code: 205}}))).toThrow('did not answer OK')
  expect(() => parsePicLookup(ok([]))).toThrow('no square_192')
  expect(() => parsePicLookup(ok([{square_192: 'a'}, {square_192: 'b'}]))).toThrow('no square_192')
  expect(() => parsePicLookup(ok([{square_360: 'a'}]))).toThrow('no square_192')
})
