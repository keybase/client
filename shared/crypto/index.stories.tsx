import input from './input/index.stories'
import list from './operations-list/index.stories'
import output from './output/index.stories'
import recipients from './recipients/index.stories'
import row from './operations-list/operation-row/index.stories'

const load = () => {
  input()
  list()
  output()
  recipients()
  row()
}

export default load
