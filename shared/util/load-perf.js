// @flow
import {reactPerf} from '../local-debug'

function print (...rest) {
  console.log(`%c⏱ React perf: ${rest}`, 'font-size: x-large')
}

export default function () {
  let start = false
  const onPerf = showDom => {
    setImmediate(() => {
      const Perf = require('react-addons-perf')

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

  if (reactPerf) {
    onPerf(false)
  }

  window.KBPERF = onPerf
}

