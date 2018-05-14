// @flow
import * as I from 'immutable'
import * as React from 'react'
import {type Path, type LeafTags, pathToString, makeLeafTags, type RouteStateNode, type RouteDefNode} from '.'
import {putActionIfOnPath, navigateUp, navigateAppend} from '../actions/route-tree'
import Box from '../common-adapters/box'

import type {Action} from '../constants/types/flux'
import type {Tab} from '../constants/tabs'

type _RenderRouteResult = {
  path: I.List<string>,
  tags: LeafTags,
  component: ({shouldRender: boolean, key?: string}) => React.Node,
  leafComponent: ({shouldRender: boolean, key?: string}) => React.Node,
}

export type RenderRouteResult = I.RecordOf<_RenderRouteResult>
const makeRenderRouteResult: I.RecordFactory<_RenderRouteResult> = I.Record({
  path: I.List(),
  tags: makeLeafTags(),
  component: () => null,
  leafComponent: () => null,
})

export type RouteRenderStack = I.Stack<RenderRouteResult>

// Components rendered by routes receive the following props:
export type RouteProps<P, S> = {
  // Whether the route is the primary onscreen route.
  shouldRender: boolean,

  // Route props (query params)
  routeProps: I.RecordOf<P>,

  // Route state (state associated with this path. can change, see below)
  routeState: I.RecordOf<S>,

  // The name of the selected child route (useful for navs)
  routeSelected: Tab,

  // The path leading up to this component.
  routePath: I.List<string>,

  // Leaf tags for the current leaf route (e.g. is the child modal?)
  routeLeafTags: LeafTags,

  // Stack of child views from this component.
  routeStack: RouteRenderStack,

  // Call to update the state of the route node that rendered this component.
  setRouteState: (partialState: any) => void,

  // Navigation if your path hasn't changed underneath you
  navigateUp: () => Action,
  navigateAppend: (...Array<any>) => Action,
}

type RenderRouteNodeProps<S> = {
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
class RenderRouteNode extends React.PureComponent<RenderRouteNodeProps<any>, any> {
  _setRouteState = partialState => this.props.setRouteState(this.props.path, partialState)
  _navigateUp = () => putActionIfOnPath(this.props.path, navigateUp())
  _navigateAppend = (...args) => putActionIfOnPath(this.props.path, navigateAppend(...args))

  static defaultProps: any
  render() {
    const {shouldRender, isContainer, routeDef, routeState, path, leafTags, stack, children} = this.props
    const RouteComponent: any = isContainer ? routeDef.containerComponent : routeDef.component
    if (!RouteComponent) {
      throw new Error('Missing RouteComponent')
    }
    return (
      <RouteComponent
        shouldRender={shouldRender}
        routeProps={routeState.props}
        routeState={routeState.state}
        routeSelected={routeState.selected}
        navigateUp={this._navigateUp}
        navigateAppend={this._navigateAppend}
        routePath={path}
        routeLeafTags={leafTags || makeLeafTags()}
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
}: _RenderRouteProps<any>): RouteRenderStack {
  if (!routeDef) {
    throw new Error(`Undefined route: ${pathToString(path)}`)
  } else if (!routeState) {
    throw new Error(`Missing route state: ${pathToString(path)}`)
  }

  let stack
  const selected = routeState.selected
  if (!selected) {
    // If this is the current selected (bottom) view, initialize an empty
    // stack. We'll add our view component to it as the first entry below.
    if (!routeDef.component) {
      throw new Error(`Attempt to render route without component: ${pathToString(path)}`)
    }
    stack = I.Stack()
  } else {
    // Otherwise, if this is a parent route, recurse to obtain the child stack.
    // $FlowIssue
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
        r.update('component', child => ({shouldRender, key}) => {
          const last = childStack.last()
          const leafTags = last ? last.tags : {}
          return (
            <RenderRouteNode
              shouldRender={shouldRender}
              isContainer={true}
              routeDef={routeDef}
              routeState={routeState}
              path={path}
              setRouteState={setRouteState}
              leafTags={leafTags}
              stack={childStack}
              key={key || path.join(':')}
            >
              {child({key: '0', shouldRender})}
            </RenderRouteNode>
          )
        })
      )
    }
  }

  if (routeDef.component) {
    // If this path has a leaf component to render, add it to the stack.
    const routeComponent = ({shouldRender, key}) =>
      shouldRender ? (
        <RenderRouteNode
          shouldRender={shouldRender}
          isContainer={false}
          routeDef={routeDef}
          routeState={routeState}
          path={path}
          setRouteState={setRouteState}
          key={key || path.join(':')}
        />
      ) : (
        <Box />
      )
    const result = makeRenderRouteResult({
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

export default class RenderRoute extends React.PureComponent<RenderRouteProps<any>, any> {
  static defaultProps: any
  render() {
    // renderRouteStack gives us a stack of all views down the current route path.
    // This component renders the bottom (currently visible) one.
    const viewStack = renderRouteStack({...this.props, path: I.List()})
    const last: ?RenderRouteResult = viewStack.last()
    return last ? last.component({shouldRender: false}) : null
  }
}
