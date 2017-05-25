// @flow
/* eslint-env jest */

import routeTreeReducer from '../route-tree'
import {State} from '../../constants/route-tree'
import {RouteDefNode, routeSetProps, routeNavigate} from '../../route-tree'
import {navigateAppend, navigateUp} from '../../actions/route-tree'

import type {PropsPath} from '../../route-tree'

jest.unmock('immutable')
jest.unmock('../../route-tree')
jest.unmock('../../actions/route-tree')

const demoRouteDef = new RouteDefNode({
  component: () => {},
  children: {
    foo: {
      component: () => {},
      children: {
        bar: {
          component: () => {},
          children: {
            baz: {
              component: () => {},
              children: {},
            },
          },
        },
      },
    },
    etc: {
      component: () => {},
      children: {},
    },
  },
})

describe('routeTree reducer', () => {
  describe('navigateUp action', () => {
    it('works correctly', () => {
      const routeDef = demoRouteDef
      const routeState = routeSetProps(routeDef, null, (['foo', 'bar']: PropsPath<*>))

      const action = navigateUp()
      const newState = routeTreeReducer(new State({routeDef, routeState}), action)
      expect(newState.routeDef).toBe(routeDef)
      expect(newState.routeState).toEqual(routeSetProps(routeDef, null, (['foo']: Array<string>)))
    })
  })

  describe('navigateAppend action', () => {
    it('works correctly with a normal append', () => {
      const routeDef = demoRouteDef
      const routeState = routeSetProps(routeDef, null, (['foo']: Array<string>))

      const action = navigateAppend(['bar'])
      const newState = routeTreeReducer(new State({routeDef, routeState}), action)
      expect(newState.routeDef).toBe(routeDef)
      expect(newState.routeState).toEqual(routeSetProps(routeDef, null, (['foo', 'bar']: PropsPath<*>)))
    })

    it('works correctly with a normal append with parentPath', () => {
      const routeDef = demoRouteDef
      const routeStatePre = routeSetProps(routeDef, null, (['foo', 'bar']: PropsPath<*>))
      const routeState = routeNavigate(routeDef, routeStatePre, (['etc']: Array<string>))

      const action = navigateAppend(['baz'], ['foo'])
      const newState = routeTreeReducer(new State({routeDef, routeState}), action)
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

      const action = navigateAppend(['baz'], ['foo', 'bar'])
      const newState = routeTreeReducer(new State({routeDef, routeState}), action)
      expect(newState.routeDef).toBe(routeDef)
      expect(newState.routeState).toEqual(
        routeSetProps(routeDef, null, (['baz']: Array<string>), ['foo', 'bar'])
      )
    })
  })
})
