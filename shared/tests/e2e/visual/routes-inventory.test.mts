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
test('spreads of a local map and of an inline conditional are listed', () => {
  const routes = listRoutes()
  assert.ok(routes.some(r => r.name === 'settingsTabs.logOutTab' && r.modal))
  assert.ok(routes.some(r => r.name === 'settingsTabs.typographyTab' && !r.modal))
})
test('listRoutes() includes the provision screens spread into devices/routes', () => {
  const routes = listRoutes()
  for (const name of ['codePage', 'error', 'forgotUsername', 'paperkey', 'password', 'selectOtherDevice', 'setPublicName', 'username']) {
    assert.ok(routes.some(r => r.name === name && r.file === 'provision/routes-sub.tsx'), `${name} missing`)
  }
})
