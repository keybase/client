import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToMore, tapSettingsRow} from '../helpers/navigate'
import {el, els, waitForTestID} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('device detail', () => {
  it('opens device detail page', async () => {
    await escapeToTabs()
    await navigateToMore()
    // Maestro: tapOn text: ".*Devices" — label match for the Devices menu item
    await tapSettingsRow('Devices')
    await waitForTestID(T.DEVICES_LIST, 3000)
    await waitForTestID(T.DEVICES_ROW, 3000)

    await els(T.DEVICES_ROW)[0]!.click()
    await waitForTestID(T.DEVICE_PAGE, 5000)
    await expect(el(T.DEVICE_PAGE)).toExist()
  })
})
