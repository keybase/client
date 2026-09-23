/// <reference types="jest" />
import {parsePushTapPayload, resolvePushTap} from './push-tap-resolve'

const route = (url: string, targetUid: string) => ({targetUid, url})

// payload is the push as the OS delivered it, as JSON: APNs userInfo on iOS, the FCM data Bundle on
// Android.
const cases: Array<[name: string, payload: string, want: ReturnType<typeof route> | undefined]> = [
  [
    'chat with account',
    `{"type":"chat.newmessage","convID":"0000ab","uid":"u1"}`,
    route('keybase://convid/0000ab', 'u1'),
  ],
  ['chat without account', `{"type":"chat.newmessage","convID":"0000ab"}`, route('keybase://convid/0000ab', '')],
  ['chat without conversation', `{"type":"chat.newmessage"}`, undefined],
  [
    'apns chat with numbers and aps',
    `{"type":"chat.newmessage","convID":"0000ab","uid":"u1","t":1,"aps":{"alert":{"body":"hi"}}}`,
    route('keybase://convid/0000ab', 'u1'),
  ],
  ['a numeric convID becomes a string', `{"type":"chat.newmessage","convID":1234}`, route('keybase://convid/1234', '')],
  [
    'the uid is kept verbatim',
    `{"type":"chat.newmessage","convID":"0000ab","uid":"u 1&x"}`,
    route('keybase://convid/0000ab', 'u 1&x'),
  ],
  [
    'follow with uid',
    `{"type":"follow","username":"testuser","uid":"u1"}`,
    route('keybase://profile/show/testuser', 'u1'),
  ],
  [
    'follow with targetUID',
    `{"type":"follow","username":"testuser","targetUID":"u2"}`,
    route('keybase://profile/show/testuser', 'u2'),
  ],
  ['follow without username', `{"type":"follow","uid":"u1"}`, undefined],
  ['new device', `{"type":"device.new","uid":"u1","device_id":"d1"}`, route('keybase://devices', 'u1')],
  ['revoked device without account', `{"type":"device.revoked","device_id":"d1"}`, undefined],
  ['contacts joined', `{"message":"Your contact testuser joined Keybase"}`, route('keybase://tabs.peopleTab', '')],
  ['read receipt', `{"type":"chat.readmessage","b":0,"message":"Your contact x"}`, undefined],
  ['silent chat', `{"type":"chat.newmessageSilent_2","c":"0000ab"}`, undefined],
  ['autoreset', `{"type":"autoreset","uid":"u1"}`, undefined],
  ['failed pending', `{"type":"chat.failedpending","convID":"0000ab","uid":""}`, undefined],
  ['an unknown type opens nothing', `{"type":"something.new","uid":"u1"}`, undefined],
  ['not json', `not json`, undefined],
  ['json that is not an object', `"just a string"`, undefined],
  ['json with trailing garbage', `{"type":"chat.newmessage","convID":"0000ab"} x`, undefined],
  [
    'a conversation id is escaped into the URL',
    `{"type":"chat.newmessage","convID":"a/b c&d"}`,
    route('keybase://convid/a%2Fb%20c%26d', ''),
  ],
  [
    'a username is escaped into the URL',
    `{"type":"follow","username":"a b/c"}`,
    route('keybase://profile/show/a%20b%2Fc', ''),
  ],
  ['a non-string message is not a contact push', `{"message":1}`, undefined],
]

test.each(cases)('%s', (_name, payload, want) => {
  const parsed = parsePushTapPayload(payload)
  expect(parsed === undefined ? undefined : resolvePushTap(parsed)).toEqual(want)
})

test('an array is not a payload', () => {
  expect(parsePushTapPayload('[1,2]')).toBeUndefined()
  expect(parsePushTapPayload('null')).toBeUndefined()
})
