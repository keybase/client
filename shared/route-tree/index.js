// @flow
import * as React from 'react'
import * as I from 'immutable'

// I put a lot of FlowIssues here so I could get this checked in. The typing of this isn't perfect, but it's getting closer

type _LeafTags = {
  persistChildren: boolean, // Whether to persist children state when navigating to this route.
  modal: boolean,
  layerOnTop: boolean,
  underStatusBar: boolean, // mobile only
  showStatusBarDarkContent: boolean, // mobile only
  hideStatusBar: boolean, // mobile only
  fullscreen: boolean,
  keepKeyboardOnLeave: boolean,
  root: boolean,
  title: ?string,
}

export type LeafTags = I.RecordOf<_LeafTags>
export const makeLeafTags: I.RecordFactory<_LeafTags> = I.Record({
  persistChildren: false,
  modal: false,
  layerOnTop: false,
  underStatusBar: false,
  hideStatusBar: false,
  showStatusBarDarkContent: false,
  fullscreen: false,
  keepKeyboardOnLeave: false,
  root: false, // only used by the root shim to allow special padding logic as its the root container
  title: null,
})

// TODO type this properly. component and container component are mutually exclusive
export type RouteDefParams = {
  component?: ?React.ComponentType<any>,
  containerComponent?: ?React.ComponentType<any>,
  defaultSelected?: ?string,
  tags?: ?LeafTags,
  initialState?: ?Object,
  // Returning any but really a RouteDefNode
  children?: {[key: string]: RouteDefParams | (() => RouteDefParams)} | ((name: string) => RouteDefParams),
}

type _RouteDefNode = {
  component: ?React.ComponentType<any>,
  containerComponent: ?React.ComponentType<any>,
  defaultSelected: ?string,
  tags: LeafTags,
  initialState: ?I.Map<any, any>,
  children: I.Map<string, RouteDefParams | (() => RouteDefParams)> | ((name: string) => RouteDefParams),
}

export type RouteDefNode = I.RecordOf<_RouteDefNode>

const _makeRouteDefNode: I.RecordFactory<_RouteDefNode> = I.Record({
  defaultSelected: null,
  component: null,
  containerComponent: null,
  tags: makeLeafTags(),
  initialState: I.Map(),
  children: I.Map(),
})

class MakeRouteDefNodeClass extends _makeRouteDefNode {
  children: any
  constructor({defaultSelected, component, containerComponent, tags, initialState, children}) {
    // $FlowIssue
    super({
      defaultSelected: defaultSelected || null,
      component,
      containerComponent,
      tags,
      initialState: I.Map(initialState),
      props: I.Map(),
      state: I.Map(),
      children:
        typeof children === 'function'
          ? children
          : I.Seq(children)
              .map(
                params =>
                  params instanceof MakeRouteDefNodeClass || typeof params === 'function'
                    ? params
                    : makeRouteDefNode(params)
              )
              .toMap(),
    })
  }

  getChild(name: string): ?RouteDefNode {
    if (typeof this.children === 'function') {
      return this.children(name)
    }

    const childDef = this.children.get(name)
    if (childDef && typeof childDef === 'function') {
      return childDef(name)
    }
    return childDef
  }
}

// $FlowIssue
export const makeRouteDefNode: I.RecordFactory<RouteDefParams> = params => new MakeRouteDefNodeClass(params)

type _RouteState = {
  selected: ?string,
  props: I.Map<string, any>,
  state: I.Map<string, any>,
  children: I.Map<string, any>,
}

export type RouteStateNode = I.RecordOf<
  // $FlowIssue
  _RouteState & {
    // Not part of the record really but here cause flow gets confused about extending from the record
    getChild: (name: string) => ?I.RecordOf<RouteStateNode>,
    updateChild: (
      name: string,
      op: (node: ?I.RecordOf<RouteStateNode>) => ?I.RecordOf<RouteStateNode>
    ) => ?I.RecordOf<RouteStateNode>,
  }
>

const _makeRouteStateNode: I.RecordFactory<
  _RouteState & {
    // Not part of the record really but here cause flow gets confused about extending from the record
    getChild: (name: string) => ?I.RecordOf<RouteStateNode>,
    updateChild: (
      name: string,
      op: (node: ?I.RecordOf<RouteStateNode>) => ?I.RecordOf<RouteStateNode>
    ) => ?I.RecordOf<RouteStateNode>,
  }
> = I.Record({
  selected: null,
  props: I.Map(),
  state: I.Map(),
  children: I.Map(),
})

class MakeRouteStateNode extends _makeRouteStateNode {
  children: I.Map<string, any>

  getChild(name: string): ?RouteStateNode {
    return this.children.get(name)
  }

  updateChild(name: string, op: (node: ?RouteStateNode) => ?RouteStateNode): ?RouteStateNode {
    return this.updateIn(['children', name], op)
  }
}

// $FlowIssue
export const makeRouteStateNode = (params: RouteDefParams) => new MakeRouteStateNode(params)

// Converts plain old objects into route state nodes. Useful for testing
export function dataToRouteState(data: Object): RouteStateNode {
  const {children, ...params} = data
  const root: RouteStateNode = makeRouteStateNode(params)
  const parsedChildren = Object.keys(children).map(k => ({name: k, op: () => dataToRouteState(children[k])}))
  return parsedChildren.reduce(
    (acc: RouteStateNode, {name, op}): RouteStateNode => acc.updateChild(name, op),
    root
  )
}

// Explicit list of iterable types to accept. We don't want to allow strings
// since navigateTo('foo') instead of navigateTo(['foo']) is an easy mistake to
// make.
type PathIterable<X> = I.IndexedSeq<X> | I.List<X> | Array<X>
export type Path = PathIterable<string>
export type PropsPath<P> = PathIterable<string | {selected: string | null, props: P}>
type PathParam<P> = [] | Path | PropsPath<P> // Flow doesn't accept Path as a subtype of PropsPath, so be explicit here.
type PathSetSpec<P> = I.Collection.Indexed<{type: 'traverse' | 'navigate', next: string | null, props?: P}>

// Traverse a routeState making changes according to the pathSpec. This is the
// primary mutation function for navigation and changing props. It will follow
// the "next" props of each item in the pathSpec, then following any
// defaultSelected from the routeDefs. It creates any routeState nodes that
// don't exist along the way.
function _routeSet(
  routeDef: RouteDefNode,
  routeState: ?RouteStateNode,
  pathSpec: PathSetSpec<any>
): RouteStateNode {
  const pathHead = pathSpec && pathSpec.first()

  let newRouteState =
    routeState ||
    // Set the initial state off of the route def
    // $FlowIssue
    makeRouteStateNode({selected: routeDef.defaultSelected, state: I.Map(routeDef.initialState)})
  if (pathHead && pathHead.type === 'navigate') {
    newRouteState = newRouteState.set('selected', pathHead.next || routeDef.defaultSelected)
    if (pathHead.next === null && (!routeDef.tags || !routeDef.tags.persistChildren)) {
      // Navigating to a route clears out the state of any children that may
      // have previously been displayed.
      newRouteState = newRouteState.delete('children')
    }
  }

  const childName = pathHead && pathHead.type === 'traverse' ? pathHead.next : newRouteState.selected
  if (childName !== null) {
    // $FlowIssue
    const childDef = routeDef.getChild(childName)
    if (!childDef) {
      throw new Error(`Invalid route child: ${childName}`)
    }

    newRouteState = newRouteState.updateChild(childName, childState => {
      let newChild = _routeSet(childDef, childState, pathSpec.skip(1))
      if (pathHead && pathHead.hasOwnProperty('props')) {
        newChild = newChild.set('props', I.Map(pathHead.props))
      }
      return newChild
    })
  }

  // $FlowIssue
  return newRouteState
}

export function routeSetProps(
  routeDef: ?RouteDefNode,
  routeState: ?RouteStateNode,
  pathProps: PathParam<any>,
  parentPath: ?Path
): RouteStateNode {
  const pathSeq = I.Seq(pathProps).map(item => {
    if (typeof item === 'string') {
      return {type: 'navigate', next: item}
    } else {
      return {type: 'navigate', next: item.selected, props: item.props}
    }
  })
  const parentPathSeq = I.Seq(parentPath || []).map(item => {
    return {type: 'traverse', next: item}
  })
  // $FlowIssue
  return _routeSet(routeDef, routeState, parentPathSeq.concat(pathSeq))
}

export function routeNavigate(
  routeDef: ?RouteDefNode,
  routeState: ?RouteStateNode,
  pathProps: PathParam<any>,
  parentPath: ?Path
): RouteStateNode {
  return routeSetProps(routeDef, routeState, I.List(pathProps).push({selected: null, props: {}}), parentPath)
}

export function routeSetState(
  routeDef: ?RouteDefNode,
  routeState: ?RouteStateNode,
  path: Path,
  partialState: {} | ((oldState: I.Map<string, any>) => I.Map<string, any>)
): RouteStateNode {
  const pathSeq = I.Seq(path)
  const name = pathSeq.first()
  if (!name && routeState) {
    return typeof partialState === 'function'
      ? routeState.update('state', partialState)
      : routeState.update('state', state => state.merge(partialState))
  }
  // $FlowIssue
  return routeState.updateChild(name, childState => {
    if (!childState) {
      throw new Error(`Missing state child: ${name || 'undefined'}`)
    }
    return routeSetState(routeDef, childState, pathSeq.skip(1), partialState)
  })
}

export function routeClear(routeState: ?RouteStateNode, path: Path): ?RouteStateNode {
  if (!routeState) {
    return null
  }
  const pathSeq = I.Seq(path)
  const name = pathSeq.first()
  if (!name) {
    return null
  }
  return routeState.updateChild(name, childState => routeClear(childState, pathSeq.skip(1)))
}

// Traverse a routeState, making sure it matches the routeDef and ends on a leaf component.
export function checkRouteState(
  loggedInUserNavigated: boolean,
  routeDef: ?RouteDefNode,
  routeState: ?RouteStateNode
): ?string {
  let path = []
  let curDef = routeDef
  let curState = routeState
  while (curDef && curState && curState.selected) {
    const selected = curState.selected
    path.push(selected)
    // $FlowIssue
    curDef = curDef.getChild(selected)
    // $FlowIssue
    curState = curState.getChild(selected)
  }
  if (!curDef) {
    return `Route missing def: ${pathToString(path)}`
  }
  if (!curState) {
    return `Route missing state: ${pathToString(path)}`
  }
  if (!curDef.component) {
    return `Route missing component: ${pathToString(path)}`
  }
}

export function getPath(routeState: ?RouteStateNode, parentPath?: Path): I.List<string> {
  const path = []
  let curState = routeState

  if (parentPath) {
    for (const next of parentPath) {
      // $FlowIssue
      curState = curState && next && curState.getChild(next)
      if (!curState) {
        return I.List(path)
      }
      path.push(next)
    }
  }

  while (curState && curState.selected !== null) {
    const selected = curState.selected
    if (selected) {
      path.push(selected)
      curState = curState.getChild(selected)
    }
  }
  return I.List(path)
}

export function getPathState(routeState: ?RouteStateNode, parentPath?: Path): ?I.Map<string, any> {
  const path = []
  let curState = routeState

  if (parentPath) {
    for (const next of parentPath) {
      // $FlowIssue
      curState = curState && next && curState.getChild(next)
      if (!curState) {
        return null
      }
      path.push(next)
    }
  }

  while (curState && curState.selected) {
    // $FlowIssue
    curState = curState.getChild(curState.selected)
  }
  return curState ? curState.state : null
}

// Returns an array of props corresponding to all the nodes in the route tree
// under the given parentPath
export function getPathProps(
  routeState: ?RouteStateNode,
  parentPath: Path
): I.List<{node: ?string, props: I.Map<string, any>}> {
  const path = []
  let curState = routeState

  for (const next of parentPath) {
    // $FlowIssue
    curState = curState && curState.getChild(next)
    if (!curState) {
      // $FlowIssue
      return I.List(path)
    }
    path.push({
      node: next,
      props: curState.props,
    })
  }

  while (curState && curState.selected !== null) {
    const thisNode = curState ? curState.selected : null
    // $FlowIssue need class based interface for helpers
    curState = curState.getChild(curState.selected)
    path.push({
      node: thisNode,
      props: (curState && curState.props) || I.Map(),
    })
  }

  return I.List(path)
}

export function pathToString(path: Array<string> | I.Collection.Indexed<string>): string {
  return '/' + path.join('/')
}
