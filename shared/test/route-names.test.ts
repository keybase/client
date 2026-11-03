/// <reference types="jest" />
import {loggedOutRoutes, modalRoutes, routes} from '@/router-v2/routes'
import {loggedOutRouteNames, modalRouteNames, routeNames} from './route-names'

test('the harness registers the routes the app registers', () => {
  expect([...routeNames].sort()).toEqual(Object.keys(routes).sort())
  expect([...modalRouteNames].sort()).toEqual(Object.keys(modalRoutes).sort())
  expect([...loggedOutRouteNames].sort()).toEqual(Object.keys(loggedOutRoutes).sort())
})
