import * as React from 'react'
import Inbox from './container'
import {useIsFocused, useNavigationState} from '@react-navigation/core'

// import * as Kb from '../../common-adapters'
// import {View} from 'react-native'

// import {runOnUI} from 'react-native-reanimated'
// function triggerGC() {
//   global.gc()
//   runOnUI(() => {
//     'worklet'
//     global.gc()
//   })()
// }

// keep track of this even on unmount, else if you background / foreground you'll lose it
let _everFocused = false

const Deferred = React.memo(
  function Deferred() {
    const isFocused = useIsFocused()
    const navKey = useNavigationState(state => state.key)
    _everFocused = _everFocused || isFocused

    // const [DEBUGSHOW, setDEBUGSHOW] = React.useState(1)

    // React.useEffect(() => {
    //   const id = setInterval(() => {
    //     triggerGC()
    //   }, 1000)
    //   return () => {
    //     clearInterval(id)
    //   }
    // }, [])

    // const TEMPI = React.useCallback(() => {
    //   setDEBUGSHOW(d => d + 1)
    // }, [])
    // const TEMPD = React.useCallback(() => {
    //   setDEBUGSHOW(d => d - 1)
    // }, [])

    // const comp = (
    //   <View>
    //     <Kb.Button onClick={TEMPI} label={'ShowI' + DEBUGSHOW} />
    //     <Kb.Button onClick={TEMPD} label={'ShowD' + DEBUGSHOW} />
    //   </View>
    // )

    // if (DEBUGSHOW > 1) {
    //   return comp
    // }

    // return _everFocused ? (
    //   <View style={TEMP}>
    //     {comp}
    //     <Inbox navKey={navKey} />
    //   </View>
    // ) : null
    return _everFocused ? <Inbox navKey={navKey} /> : null
  },
  () => true
)

// const TEMP = {
//   backgroundColor: 'red',
//   height: '100%',
//   maxHeight: '100%',
//   width: '100%',
//   paddingBottom: 100,
// } as const

export default Deferred
