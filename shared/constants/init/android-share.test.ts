/// <reference types="jest" />
import * as T from '@/constants/types'
import {androidShareFromEvent} from './android-share'

test('files carry the dropped count', () => {
  expect(androidShareFromEvent({droppedCount: 1, localPaths: ['/a.pdf']})).toEqual({
    droppedCount: 1,
    type: T.RPCGen.IncomingShareType.file,
    urls: ['/a.pdf'],
  })
})

test('a share whose files all failed still routes', () => {
  expect(androidShareFromEvent({droppedCount: 2, localPaths: []})).toEqual({
    droppedCount: 2,
    type: T.RPCGen.IncomingShareType.file,
    urls: [],
  })
})

test('text sent because every file failed carries the dropped count', () => {
  expect(androidShareFromEvent({droppedCount: 1, text: 'caption'})).toEqual({
    droppedCount: 1,
    text: 'caption',
    type: T.RPCGen.IncomingShareType.text,
  })
})

test('a missing count is zero', () => {
  expect(androidShareFromEvent({text: 'hi'})).toEqual({
    droppedCount: 0,
    text: 'hi',
    type: T.RPCGen.IncomingShareType.text,
  })
})

test('an event with nothing in it is not a share', () => {
  expect(androidShareFromEvent({})).toBeUndefined()
  expect(androidShareFromEvent({droppedCount: 0, text: ''})).toBeUndefined()
})
