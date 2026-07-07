import {expect} from '@wdio/globals'
import {escapeToTabs, navigateToMore, tapSettingsRow} from '../helpers/navigate'
import {el, waitForTestID} from '../helpers/elements'
import * as T from '../../shared/test-ids'

describe('devices view', () => {
  it('renders devices list with at least one device row', async () => {
    await escapeToTabs()
    await navigateToMore()
    // Maestro: tapOn text: ".*Devices" — label match for the Devices menu item
    await tapSettingsRow('Devices')
    await waitForTestID(T.DEVICES_LIST, 3000)
    await expect(el(T.DEVICES_LIST)).toExist()

    await waitForTestID(T.DEVICES_ROW, 3000)
    await expect(el(T.DEVICES_ROW)).toExist()
  })
})
