import * as RR from 'react-redux'
import {TypedState} from '../constants/reducer'
import flags from './feature-flags'
import shallowEqual from 'shallowequal'
import {red} from './local-console'

const checkedMSP = new WeakMap()

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

const connect_ = RR.connect

const connect: RR.Connect<TypedState> = connect_ as any

/** TODO deprecate, not compatible with hooks */
export const namedConnect = <TOwnProps, TDispatchProps, TMergedProps>(
  mapStateToProps: RR.MapStateToProps<TypedState, TOwnProps>,
  mapDispatchToProps: RR.MapDispatchToProps<TDispatchProps, TOwnProps>,
  mergeProps: RR.MergeProps<TypedState, TDispatchProps, TOwnProps, TMergedProps>,
  displayName: string,
  options?: RR.Options<TypedState, TypedState, TOwnProps, TMergedProps>
) => {
  const Connected = connect(mapStateToProps, mapDispatchToProps, mergeProps, options)
  // @ts-ignore
  Connected.displayName = displayName
  return Connected as any // RR.ConnectedComponentType<TMergedProps, TOwnProps>
}

export default connect
