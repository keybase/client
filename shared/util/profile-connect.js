// @flow
import sum from 'lodash/sum'
import {reduxPerf} from '../local-debug'
import {connect as reduxConnect, Provider} from 'react-redux'
import {hoistStatics} from 'recompose'

import typeof {connect} from 'react-redux'

const STATS = []

function instrumentConnect(connect) {
  return function profiledConnect(mapStateToProps, mapDispatchToProps, mergeProps, ...rest) {
    const metrics = {}
    STATS.push(metrics)

    function instrument(name, func) {
      const runs = []
      metrics[name] = runs

      return function(...args) {
        const start = Date.now()
        const result = func(...args)
        const end = Date.now()
        runs.push(end - start)
        return result
      }
    }

    const enhance = connect(
      mapStateToProps && instrument('mapStateToProps', mapStateToProps),
      mapDispatchToProps && instrument('mapDispatchToProps', mapDispatchToProps),
      mergeProps && instrument('mergeProps', mergeProps),
      ...rest
    )
    return hoistStatics(function(component) {
      metrics.name = component.displayName || component.name
      return enhance(component)
    })
  }
}

const connect = reduxPerf ? instrumentConnect(reduxConnect) : reduxConnect

if (reduxPerf) {
  window.reduxStats = STATS
  window.printReduxStats = function() {
    const data = {}
    STATS.forEach(metrics => {
      const mapStateToProps = sum(metrics.mapStateToProps)
      const mapDispatchToProps = sum(metrics.mapDispatchToProps)
      const mergeProps = sum(metrics.mergeProps)
      const total = sum([mapStateToProps, mapDispatchToProps, mergeProps])
      data[metrics.name] = {total, mapStateToProps, mapDispatchToProps, mergeProps}
    })

    console.table(data)
  }
}

export {connect, instrumentConnect, Provider}
