import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import TopBar from '../top-bar'
import {useFsTlf} from '../common'

type Props = {
  path: T.FS.Path
}

const OfflineFolder = ({path}: Props) => {
  const syncEnabled = useFsTlf(path).syncConfig.mode === T.FS.TlfSyncMode.Enabled
  return (
    <Kb.Box2 direction="vertical" flex={1} fullWidth={true} alignItems="stretch">
      <TopBar path={path} />
      <Kb.Box2 direction="vertical" flex={1} style={styles.emptyContainer} fullWidth={true} centerChildren={true}>
        <Kb.Icon
          type={syncEnabled ? 'iconfont-clock' : 'iconfont-cloud'}
          sizeType="Huge"
          color={Kb.Styles.globalColors.black_10}
        />
        <Kb.Text type="BodySmall">
          {syncEnabled
            ? 'This folder will sync once you get back online.'
            : "You haven't synced this folder."}
        </Kb.Text>
      </Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      emptyContainer: {
        ...Kb.Styles.globalStyles.flexGrow,
        backgroundColor: Kb.Styles.globalColors.blueGrey,
      },
    }) as const
)

export default OfflineFolder
