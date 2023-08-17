import * as Kb from '../../common-adapters'
import * as Styles from '../../styles/index'
import * as T from '../../constants/types'
import TopBar from '../top-bar'
import * as C from '../../constants'

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
        color={Styles.globalColors.black_10}
      />
      <Kb.Text type="BodySmall">
        {props.syncEnabled
          ? 'This folder will sync once you get back online.'
          : "You haven't synced this folder."}
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      contentContainer: {
        flex: 1,
      },
      emptyContainer: {
        ...Styles.globalStyles.flexGrow,
        backgroundColor: Styles.globalColors.blueGrey,
        flex: 1,
      },
    }) as const
)

type OwnProps = {
  path: T.FS.Path
}

export default (ownProps: OwnProps) => {
  const {path} = ownProps
  const syncConfig = C.useFSState(s => C.getTlfFromPath(s.tlfs, path).syncConfig)
  const props = {
    ...ownProps,
    syncEnabled: !!syncConfig && syncConfig.mode === T.FS.TlfSyncMode.Enabled,
  }
  return <OfflineFolder {...props} />
}
