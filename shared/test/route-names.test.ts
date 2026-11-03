/// <reference types="jest" />
import {loggedOutRoutes, modalRoutes, routes} from '@/router-v2/routes'
import phoneInboxOptions from '@/chat/inbox/get-options'
import {loggedOutRouteNames, modalRouteNames, routeNames, routeScreenOptions} from './route-names'

test('the harness registers the routes the app registers', () => {
  expect([...routeNames].sort()).toEqual(Object.keys(routes).sort())
  expect([...modalRouteNames].sort()).toEqual(Object.keys(modalRoutes).sort())
  expect([...loggedOutRouteNames].sort()).toEqual(Object.keys(loggedOutRoutes).sort())
})

test("desktop's routes set the keep/pause/unmount options the harness gives them", () => {
  const found: Record<string, {inactiveBehavior?: string}> = {}
  for (const [name, def] of Object.entries({...routes, ...modalRoutes, ...loggedOutRoutes})) {
    const go = (def as {getOptions?: unknown}).getOptions
    let opts: {inactiveBehavior?: string} | undefined
    try {
      opts = (typeof go === 'function' ? go({navigation: {}, route: {key: name, name, params: {}}}) : go) as typeof opts
    } catch {
      // an option builder that needs a live route can't be read here; such a route sets no keep option
      opts = undefined
    }
    if (opts?.inactiveBehavior !== undefined) {
      found[name] = {inactiveBehavior: opts.inactiveBehavior}
    }
  }
  expect(found).toEqual(routeScreenOptions.desktop)
})

test("the phone's unsplit inbox keeps itself, as the harness's phone chatRoot does", () => {
  expect(routeScreenOptions.phone['chatRoot']?.inactiveBehavior).toBe(phoneInboxOptions.inactiveBehavior)
})
