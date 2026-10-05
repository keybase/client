import {useRowStyles} from './common'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import PathStatusIcon from '@/fs/common/path-status-icon'

type PlaceholderProps = {
  type: T.FS.PathType.Folder | T.FS.PathType.File
}

const PlaceholderRow = ({type}: PlaceholderProps) => {
  const styles = useStyles()
  const rowStyles = useRowStyles()
  const isFolder = type === T.FS.PathType.Folder
  return (
    <Kb.ListItem
      type="Small"
      firstItem={true /* we add divider in Rows */}
      // Rows almost always resolve to online-only, so show that status now and
      // avoid an empty gap popping into an icon once the row loads.
      statusIcon={
        <PathStatusIcon isFolder={isFolder} statusIcon={T.FS.NonUploadStaticSyncStatus.OnlineOnly} />
      }
      icon={
        <Kb.IconAuto
          type={isFolder ? 'icon-folder-placeholder-32' : 'icon-file-placeholder-32'}
          style={rowStyles.pathItemIcon}
        />
      }
      body={
        <Kb.Box2 direction="vertical" flex={1} justifyContent="center" style={rowStyles.itemBox}>
          <Kb.Placeholder style={styles.placeholder} />
        </Kb.Box2>
      }
    />
  )
}
export default PlaceholderRow

const useStyles = Kb.Styles.createStyleHook(
  () =>
    ({
      placeholder: {
        marginTop: 4,
      },
    }) as const
)
