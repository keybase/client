import prompt from './prompt/index.stories'
import promptList from './prompt-list/index.stories'
import generic from './generic/index.stories'
import giphy from './giphy/index.stories'
import unfurlList from './unfurl-list/index.stories'

const load = () => {
  prompt()
  promptList()
  generic()
  giphy()
  unfurlList()
}

export default load
