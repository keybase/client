import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as Kbfs from '../common'
import * as Container from '../../util/container'
import Actions from './actions'
import MainBanner from './main-banner/container'

/*
 *
 * If layout changes in this file cause mobile header height change, it's
 * important to update getBaseHeight otherwise KeyboardAvoidingView won't work
 * properly (in router-v2/shim.native.tsx).
 *
 */

type Props = {
  path: Types.Path
}

const MaybePublicTag = ({path}) =>
  Constants.hasPublicTag(path) ? <Kb.Meta title="public" backgroundColor={Styles.globalColors.green} /> : null

const NavMobileHeader = (props: Props) => {
  const expanded = Constants.useState(s => s.folderViewFilter !== undefined)
  const {pop} = Container.useNav()
  const setFolderViewFilter = Constants.useState(s => s.dispatch.setFolderViewFilter)

  const filterDone = setFolderViewFilter
  const triggerFilterMobile = () => setFolderViewFilter('')

  // Clear if path changes; or it's a new layer of mount (important on Android
  // since it keeps old mount around after navigateAppend).
  //
  // Ideally we'd get navigation event here and trigger it when user navigates
  // away from this screen, but Kb.NavigationEvents doesn't seem to trigger
  // anything for me at this point. So just use the fact that a new such thing
  // has been mounted as a proxy.
  React.useEffect(() => {
    filterDone()
  }, [filterDone, props.path])

  return props.path === Constants.defaultPath ? (
    <Kb.SafeAreaViewTop>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.headerContainer} centerChildren={true}>
        <Kb.Text type="BodyBig">Files</Kb.Text>
      </Kb.Box2>
      <MainBanner />
    </Kb.SafeAreaViewTop>
  ) : (
    <Kb.SafeAreaViewTop>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.headerContainer}>
        {expanded ? (
          <Kbfs.FolderViewFilter path={props.path} onCancel={filterDone} />
        ) : (
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.expandedTopContainer}>
            {pop ? (
              <Kb.BackButton badgeNumber={0 /* TODO KBFS-4109 */} onClick={pop} style={styles.backButton} />
            ) : null}
            <Kb.Box style={styles.gap} />
            <Actions path={props.path} onTriggerFilterMobile={triggerFilterMobile} />
          </Kb.Box2>
        )}
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.expandedTitleContainer}>
          <Kb.Box2
            direction="horizontal"
            fullWidth={true}
            alignItems="flex-start"
            gap="xxtiny"
            gapStart={true}
          >
            <Kbfs.PathStatusIcon path={props.path} showTooltipOnPressMobile={true} />
            <Kbfs.Filename path={props.path} selectable={true} type="BodyBig" style={styles.filename} />
          </Kb.Box2>
          <MaybePublicTag path={props.path} />
        </Kb.Box2>
        <MainBanner />
      </Kb.Box2>
    </Kb.SafeAreaViewTop>
  )
}

const getBaseHeight = (path: Types.Path) => {
  return (
    44 +
    (path === Constants.defaultPath
      ? Styles.headerExtraHeight
      : (Styles.isAndroid ? 56 : 44) + (Constants.hasPublicTag(path) ? 7 : 0))
  )
}

export const useHeaderHeight = (path: Types.Path) => {
  const bannerType = Container.useSelector(state =>
    Constants.getMainBannerType(state.fs.kbfsDaemonStatus, state.fs.overallSyncStatus)
  )
  const base = getBaseHeight(path)
  switch (bannerType) {
    case Types.MainBannerType.None:
    case Types.MainBannerType.TryingToConnect:
      return base
    case Types.MainBannerType.Offline:
      return base + 40
    case Types.MainBannerType.OutOfSpace:
      return base + 73
  }
}

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
      expandedTitleContainer: {
        backgroundColor: Styles.globalColors.white,
        padding: Styles.globalMargins.tiny,
        paddingBottom: Styles.globalMargins.xsmall + Styles.globalMargins.xxtiny,
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
      headerContainer: {
        backgroundColor: Styles.globalColors.white,
        borderBottomColor: Styles.globalColors.black_10,
        borderBottomWidth: 1,
        borderStyle: 'solid',
        minHeight: 44,
      },
    } as const)
)

export default NavMobileHeader
