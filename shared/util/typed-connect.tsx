import * as RR from 'react-redux'
import {TypedState} from '../constants/reducer'
import flags from './feature-flags'
import shallowEqual from 'shallowequal'
import {red} from './local-console'

const checkedMSP = new WeakMap()

__DEV__ &&
  flags.connectThrashCheck &&
  console.log('Connect thrash enabled' + new Array(1000).fill('!').join(''))

const compareAndComplain = (msp: any, try1: any, try2: any, loc: any) => {
  if (!shallowEqual(try1, try2)) {
    const badKeys = Object.keys(try1).reduce<Array<string>>((arr, k) => {
      if (try1[k] !== try2[k]) {
        arr.push(k)
      }
      return arr
    }, [])
    red(`Connect thrash check: bad connector! (${loc}) keys: ${badKeys}\n ${msp.toString()}`)
    console.log('Connect thrash check => right click console | Show function definition', msp) // print the closure so you can jump to it
  }
}

const connect: typeof RR.connect =
  __DEV__ && flags.connectThrashCheck
    ? (msp: any, mdp, mp, opt) => {
        let checkingMSP: any
        const loc = new Error()?.stack?.split('\n')?.[4]?.match(/(\..*)/)?.[1] ?? 'unknown'
        if (msp.length === 2) {
          checkingMSP = (state: TypedState, ownProps: any) => {
            // only check once
            if (!checkedMSP.has(msp)) {
              checkedMSP.set(msp, true)
              // call twice and see if it mutates, which is bad
              const try1 = msp(state, ownProps)
              const try2 = msp(state, ownProps)
              compareAndComplain(msp, try1, try2, loc)
              return try2
            }
            return msp(state, ownProps)
          }
        } else {
          checkingMSP = (state: TypedState) => {
            // only check once
            if (!checkedMSP.has(msp)) {
              checkedMSP.set(msp, true)
              // call twice and see if it mutates, which is bad
              const try1 = msp(state)
              const try2 = msp(state)
              compareAndComplain(msp, try1, try2, loc)
              return try2
            }
            return msp(state)
          }
        }
        return RR.connect(checkingMSP, mdp, mp, opt)
      }
    : RR.connect

/** TODO deprecate, not compatible with hooks */
export const namedConnect = <TOwnProps, TStateProps, TDispatchProps, TMergedProps>(
  mapStateToProps: RR.MapStateToProps<TStateProps, TOwnProps>,
  mapDispatchToProps: RR.MapDispatchToProps<TDispatchProps, TOwnProps>,
  mergeProps: RR.MergeProps<TStateProps, TDispatchProps, TOwnProps, TMergedProps>,
  displayName: string,
  options?: RR.Options<TypedState, TStateProps, TOwnProps, TMergedProps>
) => {
  const Connected = connect(mapStateToProps, mapDispatchToProps, mergeProps, options)
  // @ts-ignore
  Connected.displayName = displayName
  return Connected as RR.ConnectedComponentType<TMergedProps, TOwnProps>
}

export default connect
