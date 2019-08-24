import resultRow from './result-row/index.stories'
import servicesFilter from './services-filter/index.stories'
import resultsList from './results-list/index.stories'
import userInput from './user-input/index.stories'

const load = () => {
  ;[servicesFilter, userInput, resultRow, resultsList].forEach(load => load())
}

export default load
