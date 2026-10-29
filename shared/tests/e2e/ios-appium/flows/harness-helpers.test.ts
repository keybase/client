import {navigateToMore, navigateToPeople} from '../helpers/navigate'

describe('harness helpers', () => {
  it('opens Settings by the tab bar and comes back', async () => {
    await navigateToMore()
    await navigateToPeople()
  })
})
