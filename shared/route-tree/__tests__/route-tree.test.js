// @noflow
/* eslint-env jest */
import * as I from 'immutable'

import {
  pathToString,
  makeRouteDefNode,
  makeRouteStateNode,
  InvalidRouteError,
  routeSetProps,
  routeNavigate,
  routeSetState,
  routeClear,
  checkRouteState,
  getPath,
} from '../'

import type {PropsPath} from '../'

jest.unmock('immutable')

let emptyRouteDef = makeRouteDefNode({children: {}, component: () => {}})

describe('pathToString', () => {
  it('outputs / for an empty path', () => {
    expect(pathToString([])).toEqual('/')
  })

  it('stringifies and example path', () => {
    expect(pathToString(['foo', 'bar', 'baz'])).toEqual('/foo/bar/baz')
  })
})

describe('RouteDefNode', () => {
  it('constructor recurses children', () => {
    const node = makeRouteDefNode({
      children: {
        object: {children: {}},
        node: emptyRouteDef,
      },
    })

    // $FlowIssue
    expect(node).toBeInstanceOf(RouteDefNode)

    const objectChild = node.getChild('object')
    if (!objectChild) {
      return expect(objectChild).toBeTruthy()
    }
    // $FlowIssue
    expect(objectChild).toBeInstanceOf(RouteDefNode)
    expect(objectChild).toEqual(makeRouteDefNode({children: {}}))

    const nodeChild = node.getChild('node')
    if (!nodeChild) {
      return expect(nodeChild).toBeTruthy()
    }
    // $FlowIssue
    expect(nodeChild).toBeInstanceOf(RouteDefNode)
    expect(nodeChild).toEqual(emptyRouteDef)
  })

  it('getChild calls child if defined as a function', () => {
    const node = makeRouteDefNode({
      children: {
        test: () => emptyRouteDef,
      },
    })
    expect(node.getChild('test')).toBe(emptyRouteDef)
  })

  it("getChild with a children function can create a node if it doesn't exist", () => {
    const node = makeRouteDefNode({
      children: name => {
        if (name === 'newChild') {
          return emptyRouteDef
        }
      },
    })
    expect(node.getChild('newChild')).toBe(emptyRouteDef)
    expect(node.getChild('notChild')).toBeUndefined()
  })
})

describe('RouteStateNode', () => {
  it('updateChild creates a a child', () => {
    const childNode = makeRouteStateNode({selected: null})
    const node = makeRouteStateNode({selected: 'hello'})

    const mutatedNode = node.updateChild('hello', child => {
      expect(child).toBeUndefined()
      return childNode
    })
    expect(mutatedNode.getChild('hello')).toBe(childNode)
  })
})

const demoRouteDef = makeRouteDefNode({
  defaultSelected: 'foo',
  children: {
    foo: {
      children: {
        bar: emptyRouteDef,
        baz: emptyRouteDef,
      },
    },
    etc: {
      children: {},
    },
    persist: {
      children: {
        child: emptyRouteDef,
      },
      tags: {persistChildren: true},
    },
  },
})

describe('routeSetProps', () => {
  it('creates a routeState if passed a null one, following defaultSelected', () => {
    const newRouteState = routeSetProps(demoRouteDef, null, [])
    expect(newRouteState).toEqual(
      makeRouteStateNode({
        selected: 'foo',
        children: I.Map({
          foo: makeRouteStateNode({selected: null}),
        }),
      })
    )
  })

  it('maintains type of props data', () => {
    const objectProp = {hello: 'world'}
    const immutableProp = I.Map({immutable: true})
    const routeState = routeSetProps(
      demoRouteDef,
      null,
      ([{selected: 'foo', props: {objectProp, immutableProp}}]: PropsPath<*>)
    )
    const child = routeState.getChild('foo')
    if (!child) {
      return expect(child).toBeTruthy()
    }
    expect(child.props.get('objectProp')).toBe(objectProp)
    expect(child.props.get('immutableProp')).toBe(immutableProp)
  })

  it('keeps props when passed a string path item and replaces when passed an object', () => {
    const startRouteState = routeSetProps(
      demoRouteDef,
      null,
      ([{selected: 'foo', props: {hello: 'world'}}]: PropsPath<*>)
    )
    expect(startRouteState).toEqual(
      makeRouteStateNode({
        selected: 'foo',
        children: I.Map({
          foo: makeRouteStateNode({selected: null, props: I.Map({hello: 'world'})}),
        }),
      })
    )

    const newRouteState2 = routeSetProps(
      demoRouteDef,
      startRouteState,
      (['foo', {selected: 'bar', props: {it: 'works'}}]: PropsPath<*>)
    )
    expect(newRouteState2).toEqual(
      makeRouteStateNode({
        selected: 'foo',
        children: I.Map({
          foo: makeRouteStateNode({
            selected: 'bar',
            props: I.Map({hello: 'world'}),
            children: I.Map({
              bar: makeRouteStateNode({selected: null, props: I.Map({it: 'works'})}),
            }),
          }),
        }),
      })
    )
  })

  it('traverses to parentPath before changing the tree', () => {
    const startRouteState = routeSetProps(demoRouteDef, null, (['etc']: Array<string>))
    expect(startRouteState).toEqual(
      makeRouteStateNode({
        selected: 'etc',
        children: I.Map({
          etc: makeRouteStateNode({selected: null}),
        }),
      })
    )

    const newRouteState = routeSetProps(
      demoRouteDef,
      startRouteState,
      (['bar']: Array<string>),
      (['foo']: Array<string>)
    )
    expect(newRouteState).toEqual(
      makeRouteStateNode({
        selected: 'etc',
        children: I.Map({
          etc: makeRouteStateNode({selected: null}),
          foo: makeRouteStateNode({
            selected: 'bar',
            children: I.Map({
              bar: makeRouteStateNode({selected: null}),
            }),
          }),
        }),
      })
    )
  })

  it('throws when traversing to a path with missing def', () => {
    expect(() => {
      routeSetProps(demoRouteDef, null, (['etc', 'missing']: PropsPath<*>))
      // $FlowIssue
    }).toThrowError(InvalidRouteError)
  })
})

describe('routeNavigate', () => {
  it('resets the state of the destination node', () => {
    const startRouteState = routeNavigate(
      demoRouteDef,
      null,
      (['foo', {selected: 'bar', props: {hello: 'world'}}]: PropsPath<*>)
    )
    expect(startRouteState).toEqual(
      makeRouteStateNode({
        selected: 'foo',
        children: I.Map({
          foo: makeRouteStateNode({
            selected: 'bar',
            children: I.Map({
              bar: makeRouteStateNode({
                selected: null,
                props: I.Map({hello: 'world'}),
              }),
            }),
          }),
        }),
      })
    )

    const newRouteState = routeNavigate(demoRouteDef, startRouteState, (['foo']: Array<string>))
    expect(newRouteState).toEqual(
      makeRouteStateNode({
        selected: 'foo',
        children: I.Map({
          foo: makeRouteStateNode({selected: null}),
        }),
      })
    )
  })

  it('persist children for routes with persistChildren tag set', () => {
    const startRouteState = routeNavigate(
      demoRouteDef,
      null,
      (['persist', {selected: 'child', props: {hello: 'world'}}]: PropsPath<*>)
    )

    expect(startRouteState).toEqual(
      makeRouteStateNode({
        selected: 'persist',
        children: I.Map({
          persist: makeRouteStateNode({
            selected: 'child',
            children: I.Map({
              child: makeRouteStateNode({
                selected: null,
                props: I.Map({hello: 'world'}),
              }),
            }),
          }),
        }),
      })
    )

    const newRouteState = routeNavigate(demoRouteDef, startRouteState, (['persist']: Array<string>))
    expect(newRouteState).toEqual(
      makeRouteStateNode({
        selected: 'persist',
        children: I.Map({
          persist: makeRouteStateNode({
            selected: null,
            children: I.Map({
              child: makeRouteStateNode({
                selected: null,
                props: I.Map({hello: 'world'}),
              }),
            }),
          }),
        }),
      })
    )
  })
})

describe('routeSetState', () => {
  it('merges with the state of a route node at a path', () => {
    const startRouteState = routeNavigate(demoRouteDef, null, (['foo']: Array<string>))

    const newRouteState = routeSetState(demoRouteDef, startRouteState, ['foo'], {state: 'value'})
    expect(newRouteState).toEqual(
      makeRouteStateNode({
        selected: 'foo',
        children: I.Map({
          foo: makeRouteStateNode({selected: null, state: I.Map({state: 'value'})}),
        }),
      })
    )

    const newRouteState2 = routeSetState(demoRouteDef, newRouteState, ['foo'], {another: 'thing'})
    expect(newRouteState2).toEqual(
      makeRouteStateNode({
        selected: 'foo',
        children: I.Map({
          foo: makeRouteStateNode({selected: null, state: I.Map({state: 'value', another: 'thing'})}),
        }),
      })
    )
  })

  it("throws when given a path that doesn't exist", () => {
    const startRouteState = routeNavigate(demoRouteDef, null, (['foo']: Array<string>))
    expect(() => {
      routeSetState(demoRouteDef, startRouteState, ['foo', 'nonexistent'], {state: 'value'})
      // $FlowIssue
    }).toThrowError(InvalidRouteError)
  })
})

describe('routeClear', () => {
  let startRouteState
  // $FlowIssue
  beforeAll(() => {
    startRouteState = routeNavigate(
      demoRouteDef,
      null,
      ([{selected: 'foo', props: {hello: 'world'}}]: PropsPath<*>)
    )
    expect(startRouteState).toEqual(
      makeRouteStateNode({
        selected: 'foo',
        children: I.Map({
          foo: makeRouteStateNode({
            selected: null,
            props: I.Map({hello: 'world'}),
          }),
        }),
      })
    )
  })

  it('clears the state of the route tree beneath a path', () => {
    const newRouteState = routeClear(startRouteState, ['foo'])
    expect(newRouteState).toEqual(
      makeRouteStateNode({
        selected: 'foo',
        children: I.Map({
          foo: null,
        }),
      })
    )
  })

  it('bails out early if the path does not exist', () => {
    const newRouteState = routeClear(startRouteState, ['foo', 'bar', 'baz'])
    expect(newRouteState).toEqual(
      makeRouteStateNode({
        selected: 'foo',
        children: I.Map({
          foo: makeRouteStateNode({
            selected: null,
            props: I.Map({hello: 'world'}),
            children: I.Map({
              bar: null,
            }),
          }),
        }),
      })
    )
  })
})

describe('checkRouteState', () => {
  it('returns nothing for a valid state', () => {
    const routeState = routeNavigate(demoRouteDef, null, (['foo', 'bar']: PropsPath<*>))
    expect(checkRouteState(false, demoRouteDef, routeState)).toBeUndefined()
  })

  it('returns an error for a selected route missing a definition', () => {
    const routeState = routeNavigate(demoRouteDef, null, (['foo']: Array<string>)).updateChild(
      'foo',
      n => n && n.set('selected', 'nonexistent')
    )
    expect(checkRouteState(false, demoRouteDef, routeState)).toEqual('Route missing def: /foo/nonexistent')
  })

  it('returns an error for a selected route with null state', () => {
    const routeState = makeRouteStateNode({selected: 'foo'})
    expect(checkRouteState(false, demoRouteDef, routeState)).toEqual('Route missing state: /foo')
  })

  it('returns an error for a selected route missing a component', () => {
    const routeState = makeRouteStateNode({selected: null})
    expect(checkRouteState(false, demoRouteDef, routeState)).toEqual('Route missing component: /')
  })
})

describe('getPath', () => {
  it('returns the path of a route state', () => {
    const routeState = routeNavigate(demoRouteDef, null, (['foo', 'bar']: PropsPath<*>))
    expect(getPath(routeState)).toEqual(I.List(['foo', 'bar']))
  })

  it('starts with parentPath, if specified', () => {
    const routeState = routeNavigate(demoRouteDef, null, (['foo', 'bar']: PropsPath<*>))
    const routeState2 = routeNavigate(demoRouteDef, routeState, (['etc']: Array<string>))
    expect(getPath(routeState2)).toEqual(I.List(['etc']))
    expect(getPath(routeState2, ['foo'])).toEqual(I.List(['foo', 'bar']))
  })

  it('bails out early if parentPath could not be traversed fully', () => {
    const routeState = routeNavigate(demoRouteDef, null, (['foo']: Array<string>))
    expect(getPath(routeState, ['foo', 'bar'])).toEqual(I.List(['foo']))
  })
})
