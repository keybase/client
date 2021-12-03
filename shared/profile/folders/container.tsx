import {namedConnect} from '../../util/container'
import Folders from '.'

type OwnProps = {
  profileUsername: string
}

const noFolders = namedConnect(
  () => ({}),
  () => ({}),
  () => ({loadTlfs: () => {}, tlfs: []}),
  'ConnectedFolders'
)(Folders)

export default noFolders
