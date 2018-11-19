// @flow
import prompt from './prompt/index.stories'
import promptList from './prompt-list/index.stories'
import generic from './generic/index.stories'

const load = () => {
  prompt()
  promptList()
  generic()
}

export default load
