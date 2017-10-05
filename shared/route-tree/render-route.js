// @flow
import * as I from 'immutable'
import * as React from 'react'
import {LeafTags, pathToString} from './'
import {putActionIfOnPath, navigateUp, navigateAppend} from '../actions/route-tree'
import {Box} from '../common-adapters'

import type {Action} from '../constants/types/flux'
import type {Tab} from '../constants/tabs'
import type {RouteDefNode, RouteStateNode, Path} from './'
import type {KBRecord} from '../constants/types/more'

type _RenderRouteResultParams = {
  path: I.List<string>,
  tags: LeafTags,
  component: ({isActiveRoute: boolean, shouldRender: boolean}) => React.Node,
  leafComponent: ({isActiveRoute: boolean, shouldRender: boolean}) => React.Node,
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
  // Whether the route is the primary onscreen route.
  isActiveRoute: boolean,
  shouldRender: boolean,

  // Route props (query params)
  routeProps: KBRecord<P>, // Really a Map but typed as a record

  // Route state (state associated with this path. can change, see below)
  routeState: KBRecord<S>, // Really a Map but typed as a record

  // The name of the selected child route (useful for navs)
  routeSelected: Tab,

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
  isActiveRoute: boolean,
  shouldRender: boolean,
  isContainer: boolean,
  routeDef: RouteDefNode,
  routeState: RouteStateNode,
  setRouteState: (path: Path, partialState: $Shape<S>) => void,
  path: I.List<string>,
  leafTags?: LeafTags,
  stack?: RouteRenderStack,
  children?: React.Node,
}

// Helper to render a component based on route state and use
// shouldComponentUpdate (via PureComponent).
class RenderRouteNode extends React.PureComponent<RenderRouteNodeProps<*>, *> {
  _setRouteState = partialState => this.props.setRouteState(this.props.path, partialState)
  _navigateUp = () => putActionIfOnPath(this.props.path, navigateUp())
  _navigateAppend = (...args) => putActionIfOnPath(this.props.path, navigateAppend(...args))

  static defaultProps: *
  render() {
    const {
      isActiveRoute,
      shouldRender,
      isContainer,
      routeDef,
      routeState,
      path,
      leafTags,
      stack,
      children,
    } = this.props
    const RouteComponent = isContainer ? routeDef.containerComponent : routeDef.component
    return (
      <RouteComponent
        isActiveRoute={isActiveRoute}
        shouldRender={shouldRender}
        routeProps={routeState.props}
        routeState={routeState.state}
        routeSelected={routeState.selected}
        navigateUp={this._navigateUp}
        navigateAppend={this._navigateAppend}
        routePath={path}
        routeLeafTags={leafTags || LeafTags()}
        routeStack={stack || I.Stack()}
        setRouteState={this._setRouteState}
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
        r.update('component', child => ({isActiveRoute, shouldRender}) => (
          <RenderRouteNode
            isActiveRoute={isActiveRoute}
            shouldRender={shouldRender}
            isContainer={true}
            routeDef={routeDef}
            routeState={routeState}
            path={path}
            setRouteState={setRouteState}
            leafTags={childStack.last().tags}
            stack={childStack}
            key={path.join(':')}
          >
            {child({isActiveRoute, shouldRender})}
          </RenderRouteNode>
        ))
      )
    }
  }

  if (routeDef.component) {
    // If this path has a leaf component to render, add it to the stack.
    const routeComponent = ({isActiveRoute, shouldRender}) =>
      shouldRender
        ? <RenderRouteNode
            isActiveRoute={isActiveRoute}
            shouldRender={shouldRender}
            isContainer={false}
            routeDef={routeDef}
            routeState={routeState}
            path={path}
            key={path.join(':')}
            setRouteState={setRouteState}
          />
        : <Box />
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

export default class RenderRoute extends React.PureComponent<RenderRouteProps<*>, *> {
  static defaultProps: *
  render() {
    // renderRouteStack gives us a stack of all views down the current route path.
    // This component renders the bottom (currently visible) one.
    var viewStack = renderRouteStack({...this.props, path: I.List()})
    return viewStack.last().component({isActiveRoute: true})
  }
}
