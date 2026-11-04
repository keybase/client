import * as net from 'net'
import {holderFromPs, portHolders} from './ports'
import {macTest} from '../mac-test'

test('holderFromPs reads pgid and command, trimming the command to 120 chars', () => {
  expect(holderFromPs(42, ' 777 /usr/bin/node server.js --port 8081\n')).toEqual({
    command: '/usr/bin/node server.js --port 8081',
    pgid: 777,
    pid: 42,
  })
  expect(holderFromPs(1, `5 ${'x'.repeat(200)}`).command).toHaveLength(120)
  expect(holderFromPs(9, '')).toEqual({command: '', pgid: -1, pid: 9})
})

macTest('portHolders names this process as the holder of a port it listens on, and none for a free port', async () => {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as net.AddressInfo).port
  try {
    const r = portHolders(port)
    expect('holders' in r && r.holders.map(h => h.pid)).toContain(process.pid)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
  expect(portHolders(port)).toEqual({holders: []})
})
