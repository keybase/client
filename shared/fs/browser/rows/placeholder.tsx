import {useRowStyles} from './common'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'

type PlaceholderProps = {
  type: T.FS.PathType.Folder | T.FS.PathType.File
}

const PlaceholderRow = ({type}: PlaceholderProps) => {
  const styles = useStyles()
  const rowStyles = useRowStyles()
  return (
    <Kb.ListItem
      type="Small"
      firstItem={true /* we add divider in Rows */}
      statusIcon={<Kb.Box2 direction="vertical" />}
      icon={
        <Kb.IconAuto
          type={type === T.FS.PathType.Folder ? 'icon-folder-placeholder-32' : 'icon-file-placeholder-32'}
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
