/// <reference types="jest" />
import * as T from '@/constants/types'
import {getContentDescriptionText} from './index'

const item = (i: Partial<T.RPCGen.IncomingShareItem>): T.RPCGen.IncomingShareItem =>
  ({type: T.RPCGen.IncomingShareType.file, ...i}) as T.RPCGen.IncomingShareItem

test('nothing shared has no description', () => {
  expect(getContentDescriptionText([])).toBe('')
})

test('a single text share shows its content', () => {
  expect(
    getContentDescriptionText([item({content: 'hello there', type: T.RPCGen.IncomingShareType.text})])
  ).toBe('hello there')
})

test('a single file share shows its file name', () => {
  expect(getContentDescriptionText([item({originalPath: '/tmp/some/photo.png'})])).toBe('photo.png')
})

test('a single file share with no name falls back to the type', () => {
  expect(getContentDescriptionText([item({originalPath: ''})])).toBe('1 file')
  expect(getContentDescriptionText([item({type: T.RPCGen.IncomingShareType.image})])).toBe('1 image')
  expect(getContentDescriptionText([item({type: T.RPCGen.IncomingShareType.video})])).toBe('1 video')
  expect(getContentDescriptionText([item({type: T.RPCGen.IncomingShareType.text})])).toBe('1 text snippet')
})

test('several shares of one type are counted and pluralized', () => {
  const items = [item({originalPath: '/tmp/a.png'}), item({originalPath: '/tmp/b.png'})]

  expect(getContentDescriptionText(items)).toBe('2 files')
})

test('several images are pluralized by their own type', () => {
  const items = [
    item({originalPath: '/tmp/a.png', type: T.RPCGen.IncomingShareType.image}),
    item({originalPath: '/tmp/b.png', type: T.RPCGen.IncomingShareType.image}),
    item({originalPath: '/tmp/c.png', type: T.RPCGen.IncomingShareType.image}),
  ]

  expect(getContentDescriptionText(items)).toBe('3 images')
})

test('a mixed share falls back to a plain item count', () => {
  const items = [
    item({originalPath: '/tmp/a.png', type: T.RPCGen.IncomingShareType.image}),
    item({content: 'hello', type: T.RPCGen.IncomingShareType.text}),
  ]

  expect(getContentDescriptionText(items)).toBe('2 items')
})
