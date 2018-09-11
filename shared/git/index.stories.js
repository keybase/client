// @flow
import newRepo from './new-repo/index.stories'
import deleteRepo from './delete-repo/index.stories'

const load = () => {
  deleteRepo()
  newRepo()
}

export default load
