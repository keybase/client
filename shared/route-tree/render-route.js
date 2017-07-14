// @flow
import * as I from 'immutable'
import React, {PureComponent} from 'react'
import {LeafTags, pathToString} from './'
import {putActionIfOnPath, navigateUp, navigateAppend} from '../actions/route-tree'

import type {Action} from '../constants/types/flux'
import type {RouteDefNode, RouteStateNode, Path} from './'

type _RenderRouteResultParams = {
  path: I.List<string>,
  tags: LeafTags,
  component: React$Element<any>,
  leafComponent: React$Element<any>,
}

export const RenderRouteResult: (
  spec?: _RenderRouteResultParams
) => _RenderRouteResultParams & I.Record<_RenderRouteResultParams> = I.Record({
  path: I.List(),
  tags: LeafTags(),
  component: null,
  leafComponent: null,
})

export type RouteRenderStack = I.Stack<RenderRouteResult>

// Components rendered by routes receive the following props:
export type RouteProps<P, S> = {
  // Route props (query params)
  routeProps: P,

  // Route state (state associated with this path. can change, see below)
  routeState: S,

  // The name of the selected child route (useful for navs)
  routeSelected: string,

  // The path leading up to this component.
  routePath: I.List<string>,

  // Leaf tags for the current leaf route (e.g. is the child modal?)
  routeLeafTags: LeafTags,

  // Stack of child views from this component.
  routeStack: RouteRenderStack,

  // Call to update the state of the route node that rendered this component.
  setRouteState: (partialState: $Shape<S>) => void,

  // Navigation if your path hasn't changed underneath you
  navigateUp: () => Action,
  navigateAppend: () => Action,
}

type RenderRouteNodeProps<S> = {
  isContainer: boolean,
  routeDef: RouteDefNode,
  routeState: RouteStateNode,
  setRouteState: (path: Path, partialState: $Shape<S>) => void,
  path: I.List<string>,
  leafTags?: LeafTags,
  stack?: RouteRenderStack,
  children?: React$Element<*>,
}

// Helper to render a component based on route state and use
// shouldComponentUpdate (via PureComponent).
class RenderRouteNode extends PureComponent<*, RenderRouteNodeProps<*>, *> {
  render() {
    const {isContainer, routeDef, routeState, setRouteState, path, leafTags, stack, children} = this.props
    const RouteComponent = isContainer ? routeDef.containerComponent : routeDef.component
    return (
      <RouteComponent
        routeProps={routeState.props.toObject()}
        routeState={routeDef.initialState.merge(routeState.state).toObject()}
        routeSelected={routeState.selected}
        navigateUp={() => putActionIfOnPath(path, navigateUp())}
        navigateAppend={(...args) => putActionIfOnPath(path, navigateAppend(...args))}
        routePath={path}
        routeLeafTags={leafTags || LeafTags()}
        routeStack={stack || I.Stack()}
        setRouteState={partialState => setRouteState(path, partialState)}
      >
        {children}
      </RouteComponent>
    )
  }
}

type _RenderRouteProps<S> = {
  path: I.List<string>,
  routeDef: ?RouteDefNode,
  routeState: ?RouteStateNode,
  setRouteState: (partialState: $Shape<S>) => void,
}

// Render a route tree recursively. Returns a stack of rendered components from
// the bottom (the currently visible view) up through each parent path.
function renderRouteStack({
  routeDef,
  routeState,
  setRouteState,
  path,
}: _RenderRouteProps<*>): RouteRenderStack {
  if (!routeDef) {
    throw new Error(`Undefined route: ${pathToString(path)}`)
  } else if (!routeState) {
    throw new Error(`Missing route state: ${pathToString(path)}`)
  }

  let stack
  const selected = routeState.selected
  if (selected === null) {
    // If this is the current selected (bottom) view, initialize an empty
    // stack. We'll add our view component to it as the first entry below.
    if (!routeDef.component) {
      throw new Error(`Attempt to render route without component: ${pathToString(path)}`)
    }
    stack = I.Stack()
  } else {
    // Otherwise, if this is a parent route, recurse to obtain the child stack.
    let childDef = routeDef.getChild(selected)
    const childState = routeState.children.get(selected)
    const childPath = path.push(selected)
    const childStack = renderRouteStack({
      routeDef: childDef,
      routeState: childState,
      path: childPath,
      setRouteState,
    })

    stack = childStack
    if (routeDef.containerComponent) {
      // If this route specifies a container component, compose it around every
      // view in the stack.
      stack = stack.map(r =>
        r.update('component', child => (
          <RenderRouteNode
            isContainer={true}
            routeDef={routeDef}
            routeState={routeState}
            path={path}
            setRouteState={setRouteState}
            leafTags={childStack.last().tags}
            stack={childStack}
          >
            {child}
          </RenderRouteNode>
        ))
      )
    }
  }

  if (routeDef.component) {
    // If this path has a leaf component to render, add it to the stack.
    const routeComponent = (
      <RenderRouteNode
        isContainer={false}
        routeDef={routeDef}
        routeState={routeState}
        path={path}
        setRouteState={setRouteState}
      />
    )
    const result = new RenderRouteResult({
      path,
      component: routeComponent,
      leafComponent: routeComponent,
      tags: routeDef.tags,
    })
    stack = stack.unshift(result)
  }

  return stack
}

type RenderRouteProps<S> = {
  routeDef: RouteDefNode,
  routeState: RouteStateNode,
  setRouteState: (partialState: $Shape<S>) => void,
}

export {renderRouteStack}

export default class RenderRoute extends PureComponent<*, RenderRouteProps<*>, *> {
  render() {
    // renderRouteStack gives us a stack of all views down the current route path.
    // This component renders the bottom (currently visible) one.
    var viewStack = renderRouteStack({...this.props, path: I.List()})
    return viewStack.last().component
  }
}
