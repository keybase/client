// @flow
import * as I from 'immutable'
import type {Component} from 'react'
import type {ConnectedComponent} from 'react-redux'
import type {ConnectedComponent as TypedConnectedComponent} from '../util/typed-connect'

type LeafTagsParams = {
  persistChildren: boolean, // Whether to persist children state when navigating to this route.
  modal: boolean,
  layerOnTop: boolean,
  underStatusBar: boolean,
  showStatusBarDarkContent: boolean,
  hideStatusBar: boolean,
  fullscreen: boolean,
  keepKeyboardOnLeave: boolean,
}

export const LeafTags: (spec?: LeafTagsParams) => LeafTagsParams & I.Record<LeafTagsParams> = I.Record({
  persistChildren: false,
  modal: false,
  layerOnTop: false,
  underStatusBar: false,
  hideStatusBar: false,
  showStatusBarDarkContent: false,
  fullscreen: false,
  keepKeyboardOnLeave: false,
})

const _RouteDefNode = I.Record({
  defaultSelected: null,
  component: null,
  containerComponent: null,
  tags: LeafTags(),
  initialState: I.Map(),
  children: I.Map(),
})

type RouteDefParamsCommon<P> = {
  defaultSelected?: string,
  tags?: LeafTags,
  initialState?: {},
  children?: {[key: string]: RouteDefParams<P> | (() => RouteDefNode)} | ((name: string) => RouteDefNode),
}

// TODO type this properly. component and container component are mutually exclusive
type RouteDefParams<P> = {
  component?: ?(
    | Component<any, P, any>
    | $Supertype<Component<any, P, any>>
    | Class<ConnectedComponent<P, any, any, any>>
    | Class<TypedConnectedComponent<P>>),
  containerComponent?: ?Component<any, P, any>,
  ...RouteDefParamsCommon<P>,
}

export class RouteDefNode extends _RouteDefNode {
  constructor({
    defaultSelected,
    component,
    containerComponent,
    tags,
    initialState,
    children,
  }: RouteDefParams<*>) {
    super({
      defaultSelected: defaultSelected || null,
      component,
      containerComponent,
      tags: LeafTags(tags),
      initialState: I.Map(initialState),
      props: I.Map(),
      state: I.Map(),
      children: typeof children === 'function'
        ? children
        : I.Seq(children)
            .map(
              params =>
                params instanceof RouteDefNode || typeof params === 'function'
                  ? params
                  : new RouteDefNode(params)
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

type RouteStateParams = {
  selected: string | null,
  props?: I.Map<string, any>,
  state?: I.Map<string, any>,
}

const _RouteStateNode = I.Record({
  selected: null,
  props: I.Map(),
  state: I.Map(),
  children: I.Map(),
})

export class RouteStateNode extends _RouteStateNode {
  // eslint-disable-next-line no-useless-constructor
  constructor(data: RouteStateParams) {
    super(data)
  }

  getChild(name: string): ?RouteStateNode {
    return this.children.get(name)
  }

  updateChild(name: string, op: (node: ?RouteStateNode) => ?RouteStateNode): RouteStateNode {
    return this.updateIn(['children', name], op)
  }
}

export class InvalidRouteError extends Error {}

// Explicit list of iterable types to accept. We don't want to allow strings
// since navigateTo('foo') instead of navigateTo(['foo']) is an easy mistake to
// make.
type PathIterable<X> = I.IndexedSeq<X> | I.List<X> | Array<X>
export type Path = PathIterable<string>
export type PropsPath<P> = PathIterable<string | {selected: string | null, props: P}>
type PathParam<P> = [] | Path | PropsPath<P> // Flow doesn't accept Path as a subtype of PropsPath, so be explicit here.
type PathSetSpec<P> = I.IndexedIterable<{type: 'traverse' | 'navigate', next: string | null, props?: P}>

// Traverse a routeState making changes according to the pathSpec. This is the
// primary mutation function for navigation and changing props. It will follow
// the "next" props of each item in the pathSpec, then following any
// defaultSelected from the routeDefs. It creates any routeState nodes that
// don't exist along the way.
function _routeSet(
  routeDef: RouteDefNode,
  routeState: ?RouteStateNode,
  pathSpec: PathSetSpec<*>
): RouteStateNode {
  const pathHead = pathSpec && pathSpec.first()

  let newRouteState = routeState || new RouteStateNode({selected: routeDef.defaultSelected})
  if (pathHead && pathHead.type === 'navigate') {
    newRouteState = newRouteState.set('selected', pathHead.next || routeDef.defaultSelected)
    if (pathHead.next === null && !routeDef.tags.persistChildren) {
      // Navigating to a route clears out the state of any children that may
      // have previously been displayed.
      newRouteState = newRouteState.delete('children')
    }
  }

  const childName = pathHead && pathHead.type === 'traverse' ? pathHead.next : newRouteState.selected
  if (childName !== null) {
    const childDef = routeDef.getChild(childName)
    if (!childDef) {
      throw new InvalidRouteError(`Invalid route child: ${childName}`)
    }

    newRouteState = newRouteState.updateChild(childName, childState => {
      let newChild = _routeSet(childDef, childState, pathSpec.skip(1))
      if (pathHead && pathHead.hasOwnProperty('props')) {
        newChild = newChild.set('props', I.Map(pathHead.props))
      }
      return newChild
    })
  }

  return newRouteState
}

export function routeSetProps(
  routeDef: RouteDefNode,
  routeState: ?RouteStateNode,
  pathProps: PathParam<*>,
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
  return _routeSet(routeDef, routeState, parentPathSeq.concat(pathSeq))
}

export function routeNavigate(
  routeDef: RouteDefNode,
  routeState: ?RouteStateNode,
  pathProps: PathParam<*>,
  parentPath: ?Path
): RouteStateNode {
  return routeSetProps(routeDef, routeState, I.List(pathProps).push({selected: null, props: {}}), parentPath)
}

export function routeSetState(
  routeDef: RouteDefNode,
  routeState: RouteStateNode,
  path: Path,
  partialState: {}
): RouteStateNode {
  const pathSeq = I.Seq(path)
  if (!pathSeq.size) {
    return routeState.update('state', state => state.merge(partialState))
  }
  return routeState.updateChild(pathSeq.first(), childState => {
    if (!childState) {
      throw new InvalidRouteError(`Missing state child: ${pathSeq.first()}`)
    }
    return routeSetState(routeDef, childState, pathSeq.skip(1), partialState)
  })
}

export function routeClear(routeState: ?RouteStateNode, path: Path): ?RouteStateNode {
  if (!routeState) {
    return null
  }
  const pathSeq = I.Seq(path)
  if (!pathSeq.size) {
    return null
  }
  return routeState.updateChild(pathSeq.first(), childState => routeClear(childState, pathSeq.skip(1)))
}

// Traverse a routeState, making sure it matches the routeDef and ends on a leaf component.
export function checkRouteState(routeDef: RouteDefNode, routeState: ?RouteStateNode): ?string {
  let path = []
  let curDef = routeDef
  let curState = routeState
  while (curDef && curState && curState.selected !== null) {
    path.push(curState.selected)
    curDef = curDef.getChild(curState.selected)
    curState = curState.getChild(curState.selected)
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

export function getPath(routeState: RouteStateNode, parentPath?: Path): I.List<string> {
  const path = []
  let curState = routeState

  if (parentPath) {
    for (const next of parentPath) {
      curState = curState && curState.getChild(next)
      if (!curState) {
        return I.List(path)
      }
      path.push(next)
    }
  }

  while (curState && curState.selected !== null) {
    path.push(curState.selected)
    curState = curState.getChild(curState.selected)
  }
  return I.List(path)
}

export function getPathState(routeState: RouteStateNode, parentPath?: Path): ?I.Map<string, any> {
  const path = []
  let curState = routeState

  if (parentPath) {
    for (const next of parentPath) {
      curState = curState && curState.getChild(next)
      if (!curState) {
        return null
      }
      path.push(next)
    }
  }

  while (curState && curState.selected !== null) {
    curState = curState.getChild(curState.selected)
  }
  return curState ? curState.state : null
}

export function pathToString(path: Array<string> | I.IndexedIterable<string>): string {
  return '/' + path.join('/')
}
