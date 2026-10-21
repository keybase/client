import {localFileHost} from './local-file-host.desktop'

describe('localFileHost', () => {
  it('is two lowercase labels that each start with a letter', () => {
    const labels = localFileHost.split('.')
    expect(labels).toHaveLength(2)
    for (const label of labels) {
      expect(label).toMatch(/^k[0-9a-f]{32}$/)
    }
  })
})
