/* eslint-disable @typescript-eslint/no-floating-promises */
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {listRoutes} from './routes-inventory.mts'

test('finds known routes and a sane count', () => {
  const routes = listRoutes()
  assert.ok(routes.length > 80, `only ${routes.length} routes`)
  assert.ok(routes.some(r => r.name === 'settingsRoot' && r.file === 'settings/routes.tsx' && !r.modal))
  assert.ok(routes.some(r => r.name === 'webLinks' && r.hasParams))
  assert.ok(routes.some(r => r.name === 'checkPassphraseBeforeDeleteAccount' && r.modal))
})
test('computed keys resolve to their string value', () => {
  assert.ok(listRoutes().some(r => r.name === 'settingsTabs.aboutTab'))
})
