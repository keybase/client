/// <reference types="jest" />

// jest.setup.js sets isMobile=false, isRenderer=true, and _fromPreload.functions
// with no engineSend -- exactly the "renderer up, preload never wired engineSend"
// case this test drives.
import {createClient} from './index.platform'

test('a missing engineSend fails the write instead of silently no-oping', () => {
  const client = createClient(
    () => {},
    () => {},
    () => {}
  )

  const ok = client.transport.send([1, 3, null, {}])

  expect(ok).toBe(false)
})
