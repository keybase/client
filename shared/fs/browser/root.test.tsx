/// <reference types="jest" />
import {newestTlfFirst} from './root'

test('newest TLF first, ties ordered by name whatever order they arrive in', () => {
  const tlfs = [
    {name: 'testuser-c', tlfMtime: 100},
    {name: 'testuser-a', tlfMtime: 100},
    {name: 'testuser-new', tlfMtime: 200},
    {name: 'testuser-b', tlfMtime: 100},
  ]
  const expected = ['testuser-new', 'testuser-a', 'testuser-b', 'testuser-c']
  expect([...tlfs].sort(newestTlfFirst).map(t => t.name)).toEqual(expected)
  expect([...tlfs].reverse().sort(newestTlfFirst).map(t => t.name)).toEqual(expected)
})
