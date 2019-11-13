import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as Kbfs from '../common'
import * as FsGen from '../../actions/fs-gen'
import * as Container from '../../util/container'
import Actions from './actions'
import MainBanner from './main-banner/container'
import flags from '../../util/feature-flags'

type Props = {
  onBack?: () => void
  path: Types.Path
}

const MaybePublicTag = ({path}) =>
  Constants.hasPublicTag(path) ? <Kb.Meta title="public" backgroundColor={Styles.globalColors.green} /> : null

const NavMobileHeader = (props: Props) => {
  const expanded = null !== Container.useSelector(state => state.fs.folderViewFilter)

  const dispatch = Container.useDispatch()
  const filterDone = () => dispatch(FsGen.createSetFolderViewFilter({filter: null}))
  const triggerFilterMobile = () => dispatch(FsGen.createSetFolderViewFilter({filter: ''}))

  // Clear if path changes; or it's a new layer of mount (important on Android
  // since it keeps old mount around after navigateAppend).
  //
  // Ideally we'd get navigation event here and trigger it when user navigates
  // away from this screen, but Kb.NavigationEvents doesn't seem to trigger
  // anything for me at this point. So just use the fact that a new such thing
  // has been mounted as a proxy.
  React.useEffect(() => {
    dispatch(FsGen.createSetFolderViewFilter({filter: null}))
  }, [dispatch, props.path])

  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      style={Styles.collapseStyles([styles.container, getHeightStyle(getHeight(props.path))])}
    >
      {expanded ? (
        <Kbfs.FolderViewFilter path={props.path} onCancel={filterDone} />
      ) : (
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.expandedTopContainer}>
          {props.onBack && (
            <Kb.BackButton
              badgeNumber={0 /* TODO KBFS-4109 */}
              onClick={props.onBack}
              style={styles.backButton}
            />
          )}
          <Kb.Box style={styles.gap} />
          <Actions path={props.path} onTriggerFilterMobile={triggerFilterMobile} />
        </Kb.Box2>
      )}
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.expandedTitleContainer}>
        <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="flex-start" gap="xxtiny" gapStart={true}>
          {flags.kbfsOfflineMode && <Kbfs.PathStatusIcon path={props.path} showTooltipOnPressMobile={true} />}
          <Kbfs.Filename path={props.path} selectable={true} type="BodyBig" style={styles.filename} />
        </Kb.Box2>
        <MaybePublicTag path={props.path} />
      </Kb.Box2>
      <MainBanner />
    </Kb.Box2>
  )
}

export const getHeight = (path: Types.Path) =>
  Styles.statusBarHeight + 44 + (Styles.isAndroid ? 56 : 44) + (Constants.hasPublicTag(path) ? 7 : 0)

const getHeightStyle = (height: number) => ({height, maxHeight: height, minHeight: height})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      backButton: Styles.platformStyles({
        common: {
          opacity: 1,
          paddingBottom: Styles.globalMargins.tiny,
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.tiny,
          paddingTop: Styles.globalMargins.tiny,
        },
        isAndroid: {
          paddingRight: Styles.globalMargins.small,
        },
      }),
      container: {
        backgroundColor: Styles.globalColors.white,
        borderBottomColor: Styles.globalColors.black_10,
        borderBottomWidth: 1,
        borderStyle: 'solid',
        paddingTop: Styles.isAndroid ? undefined : Styles.statusBarHeight,
      },
      expandedTitleContainer: {
        backgroundColor: Styles.globalColors.white,
        padding: Styles.globalMargins.tiny,
      },
      expandedTopContainer: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.white,
          paddingRight: Styles.globalMargins.tiny,
        },
        isAndroid: {
          height: 56,
        },
        isIOS: {
          height: 44,
        },
      }),
      filename: {
        marginLeft: Styles.globalMargins.xtiny,
      },
      gap: {
        flex: 1,
      },
    } as const)
)

export default NavMobileHeader
