// @flow
import resultRow from './result-row/index.stories'
import servicesFilter from './services-filter/index.stories'
import userInput from './user-input/index.stories'

const load = () => {
  servicesFilter()
  userInput()
  resultRow()
}

export default load
