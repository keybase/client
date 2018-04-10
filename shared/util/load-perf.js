// @flow
import {keys} from 'lodash-es'
import Perf from './react-perf'

function print(rest) {
  console.log(`%c⏱ React perf: ${rest}`, 'font-size: x-large')
}

export default function() {
  let start = false
  const onPerf = showDom => {
    setImmediate(() => {
      if (!start) {
        print('start')
        Perf.start()
      } else {
        print('stop')
        Perf.stop()
        const measurements = Perf.getLastMeasurements()
        print('Inclusive')
        Perf.printInclusive(measurements)
        print('Exclusive')
        Perf.printExclusive(measurements)
        print('Wasted')
        Perf.printWasted(measurements)
        if (showDom) {
          print('DOM')
          Perf.printDOM(measurements)
        }
      }

      start = !start
    })
  }

  if (typeof window !== 'undefined') {
    window.KBPERF = onPerf
    window.shallowEqualDebug = shallowEqualDebug
  }
}

// https://raw.githubusercontent.com/dashed/shallowequal/master/src/index.js but with debug statements
function shallowEqualDebug(objA, objB, compare, compareContext) {
  const ret = compare ? compare.call(compareContext, objA, objB) : void 0

  if (ret !== void 0) {
    console.log('Defer to compare function', ret)
    return !!ret
  }

  if (objA === objB) {
    console.log('Strictly equal ===')
    return true
  }

  if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
    console.log('Both not objects or one is null?')
    return false
  }

  const keysA = keys(objA)
  const keysB = keys(objB)

  const len = keysA.length
  if (len !== keysB.length) {
    console.log('Different number of keys', keysA, keysB)
    return false
  }

  // Test for A's keys different from B.
  const bHasOwnProperty = Object.prototype.hasOwnProperty.bind(objB)
  for (let i = 0; i < len; i++) {
    const key = keysA[i]
    if (!bHasOwnProperty(key)) {
      console.log('Missing key', key)
      return false
    }
    const valueA = objA[key]
    const valueB = objB[key]

    const ret = compare ? compare.call(compareContext || null, valueA, valueB, key) : void 0
    if (ret === false || (ret === void 0 && valueA !== valueB)) {
      console.log('Different value:', key, ':', valueA, valueB)
      return false
    }
  }

  console.log('Shallow equal')
  return true
}
