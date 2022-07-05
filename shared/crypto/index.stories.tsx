import input from './input/index.stories'
import output from './output/index.stories'
import recipients from './recipients/index.stories'

const load = () => {
  input()
  output()
  recipients()
}

export default load
