/// <reference types="jest" />

import {expect, test} from '@jest/globals'
import * as T from '@/constants/types'
import {parseServiceDecoration} from './service-decoration-parser'

const encodeServiceDecoration = (payload: unknown) => Buffer.from(JSON.stringify(payload)).toString('base64')

test('parseServiceDecoration decodes base64 UTF-8 payloads', () => {
  const url = 'https://example.com/naive/🙂'
  const encoded = encodeServiceDecoration({
    link: {punycode: '', url},
    typ: T.RPCChat.UITextDecorationTyp.link,
  })

  expect(parseServiceDecoration(encoded)).toEqual({
    link: {punycode: '', url},
    typ: T.RPCChat.UITextDecorationTyp.link,
  })
})

test('parseServiceDecoration returns undefined for invalid payloads', () => {
  expect(parseServiceDecoration('not-base64')).toBeUndefined()
})
