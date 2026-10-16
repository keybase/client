/// <reference types="jest" />
import * as T from '@/constants/types'
import {androidShareFromEvent, androidShareURL} from './android-share'

test('files carry the dropped count', () => {
  expect(androidShareFromEvent({droppedCount: 1, id: 7, localPaths: ['/a.pdf']})).toEqual({
    droppedCount: 1,
    id: 7,
    type: T.RPCGen.IncomingShareType.file,
    urls: ['/a.pdf'],
  })
})

test('a share whose files all failed still routes', () => {
  expect(androidShareFromEvent({droppedCount: 2, id: 7, localPaths: []})).toEqual({
    droppedCount: 2,
    id: 7,
    type: T.RPCGen.IncomingShareType.file,
    urls: [],
  })
})

test('text sent because every file failed carries the dropped count', () => {
  expect(androidShareFromEvent({droppedCount: 1, id: 7, text: 'caption'})).toEqual({
    droppedCount: 1,
    id: 7,
    text: 'caption',
    type: T.RPCGen.IncomingShareType.text,
  })
})

test('a missing count is zero', () => {
  expect(androidShareFromEvent({id: 7, text: 'hi'})).toEqual({
    droppedCount: 0,
    id: 7,
    text: 'hi',
    type: T.RPCGen.IncomingShareType.text,
  })
})

test('an event with nothing in it is not a share', () => {
  expect(androidShareFromEvent({id: 7})).toBeUndefined()
  expect(androidShareFromEvent({droppedCount: 0, id: 7, text: ''})).toBeUndefined()
})

test('the link names the share', () => {
  expect(androidShareURL(7)).toBe('keybase://incoming-share?androidShare=7')
})
