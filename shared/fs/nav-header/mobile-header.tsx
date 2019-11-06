import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as Container from '../../util/container'
import * as Kbfs from '../common'
import * as FsGen from '../../actions/fs-gen'
import Actions from './actions'
import MainBanner from './main-banner/container'

type Props = {
  onBack?: () => void
  path: Types.Path
}

const MaybePublicTag = ({path}) =>
  Constants.hasPublicTag(path) ? <Kb.Meta title="public" backgroundColor={Styles.globalColors.green} /> : null

const NavMobileHeader = (props: Props) => {
  const {filter} = Container.useSelector(state => Constants.getPathUserSetting(state, props.path))
  const dispatch = Kbfs.useDispatchWhenKbfsIsConnected()
  const triggerFilterMobile = () => dispatch(FsGen.createSetFolderViewFilter({filter: '', path: props.path}))
  const filterDoneMobile = () => dispatch(FsGen.createSetFolderViewFilter({filter: null, path: props.path}))
  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      style={Styles.collapseStyles([styles.container, getHeightStyle(getHeight(props.path))])}
    >
      {filter === null ? (
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
      ) : (
        <Kbfs.FolderViewFilter path={props.path} onCancel={filterDoneMobile} />
      )}
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.expandedTitleContainer}>
        <Kb.Text type="BodyBig" lineClamp={1}>
          {props.path === Constants.defaultPath ? 'Files' : Types.getPathName(props.path)}
        </Kb.Text>
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
        paddingBottom: Styles.globalMargins.tiny,
        paddingLeft: Styles.globalMargins.small,
        paddingRight: Styles.globalMargins.small,
        paddingTop: Styles.globalMargins.tiny,
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
      gap: {
        flex: 1,
      },
    } as const)
)

export default NavMobileHeader
