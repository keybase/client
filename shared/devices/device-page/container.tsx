// import * as React from 'react'
import * as Container from '../../util/container'
// import * as RouteTreeGen from '../../actions/route-tree-gen'
import DevicePage from '.'

type OwnProps = Container.RouteProps<{deviceID: string}>

// TODO(newRouter) after committing to new router:
// remove action and code that sets state.devices.selectedDeviceID.
// It's a bad pattern to have navigation distributed across react-navigation
// and our store. device id is purely an argument to the screen, the store
// doesn't care about it.

const C =  Container.connectDEBUG(
  (_, ownProps: OwnProps) => ({id: Container.getRouteProps(ownProps, 'deviceID', '')}),
  _ => ({
    onBack: () => {
      // Container.isMobile && dispatch(RouteTreeGen.createNavigateUp())
    },
  }),
  (stateProps, dispatchProps) => ({
    id: stateProps.id,
    onBack: dispatchProps.onBack,
  })
)(DevicePage)
export default C

type D = (typeof C)[1]
// const HeaderDevicePage = DevicePage
// type GetProps<C> = C extends React.ComponentType<infer P> ? P : never
// type T = GetProps<typeof HeaderDevicePage>
// type K = keyof T
// type G = T['onBack']

// type RequiredKeys<T> = {[K in keyof T]-?: ({} extends {[P in K]: T[K]} ? never : K)}[keyof T]
// type ExcludeOptionalProps<T> = Pick<T, RequiredKeys<T>>

// type E = ExcludeOptionalProps<T>

// type A = {id: number, onBack?: () => void}
// type B = {id: number; onBack: () => void, bar: string}

// type Matching<InjectedProps, DecorationTargetProps> = {
  // [P in keyof DecorationTargetProps]: P extends keyof InjectedProps
    // ? InjectedProps[P] extends DecorationTargetProps[P]
      // ? DecorationTargetProps[P]
      // : InjectedProps[P]
    // : DecorationTargetProps[P]
// }

// // type C = Matching<A, B>

// class DP extends React.Component<B> {
        // render() {return null}
    // }

// const DPP = (_: B) => null

// const BBB: React.ComponentType<Matching<A, B>> = DP
// const BBB2: React.ComponentType<Matching<A, B>> = DPP

// const a: A = {id: 3}
// const b: B = {id: 4, onBack: ()=> {}}
// const c: A = b


// type F1 = (a?: number) => boolean
// type F2 = (a: number) => boolean
// const f2: F2 = (_: number) => true
// const f1: F1 = f2



// type T1 = (() => void) | undefined
// type T2 = () => void

// const t2: T2 = () => {}
// const t1: T1 = t2

// type O1 = {b?: (a: number) => boolean}
// type O2 = {b: (a: number) => boolean}
// const o2: O2 = {b: (_: number) => true}
// const o1: O1 = o2

// console.log(a,b,c, BBB, BBB2, f1, f2, t1, t2, o1, o2)
