/// <reference types="jest" />
import {getCallPort, hasCallPort, installCallPort} from './call-port'

test('the port is empty until an engine installs itself', () => {
  expect(hasCallPort()).toBe(false)
  expect(() => getCallPort()).toThrow('No engine?')
  const port = {call: jest.fn(() => 1), cancelOutstandingSessions: jest.fn(), listen: jest.fn()}
  installCallPort(port)
  expect(getCallPort()).toBe(port)
})
