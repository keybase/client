// @flow
import {createConnect} from 'react-redux/src/connect/connect'
import defaultSelectorFactory from 'react-redux/src/connect/selectorFactory'

import typeof {connect} from 'react-redux'

function selectorFactory(dispatch, factoryOptions) {
  const selector = defaultSelectorFactory(dispatch, factoryOptions)
  let cachedResult
  const pausableSelector = function(state, ownProps) {
    if (ownProps.isActive || cachedResult === undefined) {
      cachedResult = selector(state, ownProps)
      cachedResult.isActive = ownProps.isActive
    } else if (cachedResult.isActive !== ownProps.isActive) {
      cachedResult = {...cachedResult, isActive: ownProps.isActive}
    }
    return cachedResult
  }
  return pausableSelector
}

const pausableConnect: connect = createConnect({selectorFactory})

export default pausableConnect
