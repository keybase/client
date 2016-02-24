// @flow
import {reactPerf} from '../local-debug'

function print (...rest) {
  console.log(`%c⏱ React perf: ${rest}`, 'font-size: x-large')
}

export default function () {
  let start = false
  const onPerf = () => {
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
      }

      start = !start
    })
  }

  if (reactPerf) {
    onPerf()
  }

  window.KBPERF = onPerf
}

