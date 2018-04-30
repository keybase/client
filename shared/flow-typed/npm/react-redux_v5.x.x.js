// flow-typed signature: 847294089e5de0effb782d35d58aa7ca
// flow-typed version: 113bd4da88/react-redux_v5.x.x/flow_>=v0.62.0

import type { Dispatch, Store } from "redux";

declare module "react-redux" {
  import type { ComponentType, ElementConfig } from 'react';

  declare export class Provider<S, A> extends React$Component<{
    store: Store<S, A>,
    children?: any
  }> {}

  declare export function createProvider(
    storeKey?: string,
    subKey?: string
  ): Provider<*, *>;

  /*

  S = State
  A = Action
  OP = OwnProps
  SP = StateProps
  DP = DispatchProps
  MP = Merge props
  MDP = Map dispatch to props object
  RSP = Returned state props
  RDP = Returned dispatch props
  RMP = Returned merge props
  Com = React Component
  */

  declare type MapStateToProps<RS: Object, SP: Object, RSP: Object> = (state: RS, props: SP) => RSP;

  declare type MapDispatchToProps<A, OP: Object, RDP: Object> = (dispatch: Dispatch<A>, ownProps: OP) => RDP;

  declare type MergeProps<SP: Object, DP: Object, MP: Object, RMP: Object> = (
    stateProps: SP,
    dispatchProps: DP,
    ownProps: MP
  ) => RMP;

  declare type ConnectOptions<S: Object, OP: Object, RSP: Object, RMP: Object> = {|
    pure?: boolean,
    withRef?: boolean,
    areStatesEqual?: (next: S, prev: S) => boolean,
    areOwnPropsEqual?: (next: OP, prev: OP) => boolean,
    areStatePropsEqual?: (next: RSP, prev: RSP) => boolean,
    areMergedPropsEqual?: (next: RMP, prev: RMP) => boolean,
    storeKey?: string
  |};

  declare type OmitDispatch<Component> = $Diff<Component, {dispatch: Dispatch<*>}>;

  declare export function connect<Com: ComponentType<*>, RS: Object, DP: Object, RSP: Object>(
    mapStateToProps: MapStateToProps<RS, DP, RSP>,
    mapDispatchToProps?: null
  ): (component: Com) => ComponentType<$Diff<OmitDispatch<ElementConfig<Com>>, RSP> & DP>;

  declare export function connect<Com: ComponentType<*>>(
    mapStateToProps?: null,
    mapDispatchToProps?: null
  ): (component: Com) => ComponentType<OmitDispatch<ElementConfig<Com>>>;

  declare export function connect<Com: ComponentType<*>, A, RS: Object, DP: Object, SP: Object, RSP: Object, RDP: Object>(
    mapStateToProps: MapStateToProps<RS, SP, RSP>,
    mapDispatchToProps: MapDispatchToProps<A, DP, RDP>
  ): (component: Com) => ComponentType<$Diff<$Diff<ElementConfig<Com>, RSP>, RDP> & SP & DP>;

  declare export function connect<Com: ComponentType<*>, A, OP: Object, DP: Object,PR: Object>(
    mapStateToProps?: null,
    mapDispatchToProps: MapDispatchToProps<A, OP, DP>
  ): (Com) => ComponentType<$Diff<ElementConfig<Com>, DP> & OP>;

  declare export function connect<Com: ComponentType<*>, MDP: Object>(
    mapStateToProps?: null,
    mapDispatchToProps: MDP
  ): (component: Com) => ComponentType<$Diff<ElementConfig<Com>, MDP>>;

  declare export function connect<Com: ComponentType<*>, RS: Object, SP: Object, RSP: Object, MDP: Object>(
    mapStateToProps: MapStateToProps<RS, SP, RSP>,
    mapDispatchToPRops: MDP
  ): (component: Com) => ComponentType<$Diff<$Diff<ElementConfig<Com>, RSP>, MDP> & SP>;

  declare export function connect<Com: ComponentType<*>, A, RS: Object, DP: Object, SP: Object, RSP: Object, RDP: Object, MP: Object, RMP: Object>(
    mapStateToProps: MapStateToProps<RS, SP, RSP>,
    mapDispatchToProps: ?MapDispatchToProps<A, DP, RDP>,
    mergeProps: MergeProps<RSP, RDP, MP, RMP>
  ): (component: Com) => ComponentType<$Diff<ElementConfig<Com>, RMP> & SP & DP & MP>;

  declare export function connect<Com: ComponentType<*>, A, RS: Object, DP: Object, SP: Object, RSP: Object, RDP: Object, MP: Object, RMP: Object>(
    mapStateToProps: ?MapStateToProps<RS, SP, RSP>,
    mapDispatchToProps: ?MapDispatchToProps<A, DP, RDP>,
    mergeProps: ?MergeProps<RSP, RDP, MP, RMP>,
    options: ConnectOptions<*, SP & DP & MP, RSP, RMP>
  ): (component: Com) => ComponentType<$Diff<ElementConfig<Com>, RMP> & SP & DP & MP>;

  declare export default {
    Provider: typeof Provider,
    createProvider: typeof createProvider,
    connect: typeof connect,
  };
}
