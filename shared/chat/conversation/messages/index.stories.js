// @flow
import placeholder from './placeholder/index.stories'
import text from './text/index.stories'

const load = () => {
  [placeholder, text].forEach(load => load())
}

export default load
