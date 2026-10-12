/// <reference types="jest" />
import {cacheRemoteProps, getCachedRemoteProps} from './remote-windows.desktop'

test('each props update gets a larger version, across windows', () => {
  const first = cacheRemoteProps('tracker', 'testuser', {state: 'checking'})
  const other = cacheRemoteProps('menubar', 'menubar', {loggedIn: true})
  const second = cacheRemoteProps('tracker', 'testuser', {state: 'valid'})

  expect(other.version).toBeGreaterThan(first.version)
  expect(second.version).toBeGreaterThan(other.version)
})

test('a window pulls the last props sent to it, as they were sent', () => {
  const props = {assertions: [{type: 'twitter', value: 'testuser'}], bio: undefined, darkMode: false}
  const sent = cacheRemoteProps('tracker', 'testuser-mac', props)

  expect(getCachedRemoteProps('tracker', 'testuser-mac')).toBe(sent)
  expect(sent.props).toBe(props)
  expect(getCachedRemoteProps('tracker', 'nobody')).toBeUndefined()
})
