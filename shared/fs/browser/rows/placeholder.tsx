import {rowStyles} from './common'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'

type PlaceholderProps = {
  type: T.FS.PathType.Folder | T.FS.PathType.File
}

const PlaceholderRow = ({type}: PlaceholderProps) => (
  <Kb.ListItem
    type="Small"
    firstItem={true /* we add divider in Rows */}
    statusIcon={<Kb.Box2 direction="vertical" />}
    icon={
      <Kb.Icon
        type={type === T.FS.PathType.Folder ? 'icon-folder-placeholder-32' : 'icon-file-placeholder-32'}
        style={rowStyles.pathItemIcon}
      />
    }
    body={
      <Kb.Box2 direction="vertical" style={rowStyles.itemBox}>
        <Kb.Placeholder style={styles.placeholder} />
      </Kb.Box2>
    }
  />
)
export default PlaceholderRow

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      placeholder: {
        marginTop: 4,
      },
    }) as const
)
