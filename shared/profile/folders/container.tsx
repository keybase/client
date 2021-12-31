import * as Container from '../../util/container'
import Folders from '.'

const noFolders = Container.connect(
  () => ({}),
  () => ({}),
  () => ({loadTlfs: () => {}, tlfs: []})
)(Folders)

export default noFolders
