import * as Container from '../../util/container'
import Folders from '.'

type OwnProps = {
  profileUsername: string
}

const noFolders = Container.connect(
  () => ({}),
  () => ({}),
  () => ({loadTlfs: () => {}, tlfs: []})
)(Folders)

export default noFolders
