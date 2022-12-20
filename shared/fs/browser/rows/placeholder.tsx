import {rowStyles} from './common'
import * as Styles from '../../../styles'
import * as Types from '../../../constants/types/fs'
import * as Kb from '../../../common-adapters'

type PlaceholderProps = {
  type: Types.PathType.Folder | Types.PathType.File
}

const PlaceholderRow = ({type}: PlaceholderProps) => (
  <Kb.ListItem2
    type="Small"
    firstItem={true /* we add divider in Rows */}
    statusIcon={<Kb.Box />}
    icon={
      <Kb.Icon
        type={type === Types.PathType.Folder ? 'icon-folder-placeholder-32' : 'icon-file-placeholder-32'}
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
    } as const)
)
