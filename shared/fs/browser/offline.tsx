import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import TopBar from '../top-bar'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

type Props = {
  path: T.FS.Path
  syncEnabled: boolean
}

const OfflineFolder = (props: Props) => (
  <Kb.Box2 direction="vertical" style={styles.contentContainer} fullWidth={true} alignItems="stretch">
    <TopBar path={props.path} />
    <Kb.Box2 direction="vertical" style={styles.emptyContainer} fullWidth={true} centerChildren={true}>
      <Kb.Icon
        type={props.syncEnabled ? 'iconfont-clock' : 'iconfont-cloud'}
        sizeType="Huge"
        color={Kb.Styles.globalColors.black_10}
      />
      <Kb.Text type="BodySmall">
        {props.syncEnabled
          ? 'This folder will sync once you get back online.'
          : "You haven't synced this folder."}
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      contentContainer: {
        flex: 1,
      },
      emptyContainer: {
        ...Kb.Styles.globalStyles.flexGrow,
        backgroundColor: Kb.Styles.globalColors.blueGrey,
        flex: 1,
      },
    }) as const
)

type OwnProps = {
  path: T.FS.Path
}

const Container = (ownProps: OwnProps) => {
  const {path} = ownProps
  const syncConfig = useFSState(s => FS.getTlfFromPath(s.tlfs, path).syncConfig)
  const props = {
    ...ownProps,
    syncEnabled: syncConfig.mode === T.FS.TlfSyncMode.Enabled,
  }
  return <OfflineFolder {...props} />
}

export default Container
