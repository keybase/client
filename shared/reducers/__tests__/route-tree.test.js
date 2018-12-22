// @noflow
/* eslint-env jest */

import routeTreeReducer from '../route-tree'
import {makeState} from '../../constants/route-tree'
import {makeRouteDefNode, routeSetProps, routeNavigate} from '../../route-tree'
import * as RouteTreeGen from '../../actions/route-tree-gen'

import type {PropsPath} from '../../route-tree'

jest.unmock('immutable')
jest.unmock('../../route-tree')
jest.unmock('../../actions/route-tree')

const demoRouteDef = makeRouteDefNode({
  children: {
    etc: {
      children: {},
      component: () => {},
    },
    foo: {
      children: {
        bar: {
          children: {
            baz: {
              children: {},
              component: () => {},
            },
          },
          component: () => {},
        },
      },
      component: () => {},
    },
  },
  component: () => {},
})

describe('routeTree reducer', () => {
  describe('navigateUp action', () => {
    it('works correctly', () => {
      const routeDef = demoRouteDef
      const routeState = routeSetProps(routeDef, null, (['foo', 'bar']: PropsPath<*>))

      const action = RouteTreeGen.createNavigateUp()
      const newState = routeTreeReducer(makeState({routeDef, routeState}), action)
      expect(newState.routeDef).toBe(routeDef)
      expect(newState.routeState).toEqual(routeSetProps(routeDef, null, (['foo']: Array<string>)))
    })
  })

  describe('navigateAppend action', () => {
    it('works correctly with a normal append', () => {
      const routeDef = demoRouteDef
      const routeState = routeSetProps(routeDef, null, (['foo']: Array<string>))

      const action = RouteTreeGen.createNavigateAppend({path: ['bar']})
      const newState = routeTreeReducer(makeState({routeDef, routeState}), action)
      expect(newState.routeDef).toBe(routeDef)
      expect(newState.routeState).toEqual(routeSetProps(routeDef, null, (['foo', 'bar']: PropsPath<*>)))
    })

    it('works correctly with a normal append with parentPath', () => {
      const routeDef = demoRouteDef
      const routeStatePre = routeSetProps(routeDef, null, (['foo', 'bar']: PropsPath<*>))
      const routeState = routeNavigate(routeDef, routeStatePre, (['etc']: Array<string>))

      const action = RouteTreeGen.createNavigateAppend({parentPath: ['foo'], path: ['baz']})
      const newState = routeTreeReducer(makeState({routeDef, routeState}), action)
      expect(newState.routeDef).toBe(routeDef)
      const expectedStatePre = routeSetProps(routeDef, null, (['foo', 'bar', 'baz']: PropsPath<*>))
      const expectedState = routeNavigate(routeDef, expectedStatePre, (['etc']: Array<string>))
      expect(newState.routeState).toEqual(expectedState)
    })

    it('works correctly with an append with nonexistent parentPath', () => {
      // A naive implementation of navigateAppend gets the path at parentPath
      // and then uses it as the base path to navigate under. However, if that
      // path doesn't exist, getPath() will return a truncated path (however
      // far it got into the traversal). If that truncated path is used for
      // navigation, you could get a case like:
      //
      //   (starting on /)
      //   navigateAppend(['baz'], ['foo', 'bar'])
      //   => /baz
      //
      // Whereas the caller clearly intended the /foo/bar subpath to have baz
      // selected. This test makes sure the implementation handles this tricky
      // case.

      const routeDef = demoRouteDef
      const routeState = routeSetProps(routeDef, null, [])

      const action = RouteTreeGen.createNavigateAppend({parentPath: ['foo', 'bar'], path: ['baz']})
      const newState = routeTreeReducer(makeState({routeDef, routeState}), action)
      expect(newState.routeDef).toBe(routeDef)
      expect(newState.routeState).toEqual(
        routeSetProps(routeDef, null, (['baz']: Array<string>), ['foo', 'bar'])
      )
    })
  })
})
