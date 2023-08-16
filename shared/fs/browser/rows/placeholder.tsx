import {rowStyles} from './common'
import * as Styles from '../../../styles'
import * as T from '../../../constants/types'
import * as Kb from '../../../common-adapters'

type PlaceholderProps = {
  type: T.FS.PathType.Folder | T.FS.PathType.File
}

const PlaceholderRow = ({type}: PlaceholderProps) => (
  <Kb.ListItem2
    type="Small"
    firstItem={true /* we add divider in Rows */}
    statusIcon={<Kb.Box />}
    icon={
      <Kb.Icon
        type={type === T.FS.PathType.Folder ? 'icon-folder-placeholder-32' : 'icon-file-placeholder-32'}
        style={rowStyles.pathItemIcon}
      />
    }
    body={
      <Kb.Box style={rowStyles.itemBox}>
        <Kb.Placeholder style={styles.placeholder} />
      </Kb.Box>
    }
  />
)
export default PlaceholderRow

const styles = Styles.styleSheetCreate(
  () =>
    ({
      placeholder: {
        marginTop: 4,
      },
    }) as const
)
