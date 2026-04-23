import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Kbfs from '../common'
import type * as T from '@/constants/types'
import {useModalHeaderState} from '@/stores/modal-header'
import Actions from './actions'
import MainBanner from './main-banner'
import * as FS from '@/stores/fs'

/*
 *
 * If layout changes in this file cause mobile header height change, it's
 * important to update getBaseHeight otherwise KeyboardAvoidingView won't work
 * properly (in router-v2/shim.native.tsx).
 *
 */

type Props = {
  path: T.FS.Path
}

const MaybePublicTag = ({path}: {path: T.FS.Path}) =>
  FS.hasPublicTag(path) ? <Kb.Meta title="public" backgroundColor={Kb.Styles.globalColors.green} /> : null

const FilesTabStatusIcon = () => {
  const uploadIcon = FS.useFSState(s => s.getUploadIconForFilesTab())
  return uploadIcon ? <Kbfs.UploadIcon uploadIcon={uploadIcon} style={styles.filesTabStatusIcon} /> : null
}

const NavMobileHeaderInner = (props: Props) => {
  const {expanded, folderViewFilter, setFolderViewFilter} = useModalHeaderState(
    C.useShallow(s => ({
      expanded: s.folderViewFilter !== undefined,
      folderViewFilter: s.folderViewFilter,
      setFolderViewFilter: s.dispatch.setFolderViewFilter,
    }))
  )
  const {pop} = C.useNav()

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

  return props.path === FS.defaultPath ? (
    <Kb.SafeAreaViewTop>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.headerContainer}>
        <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} gap="xtiny">
          <Kb.Text type="BodyBig">Files</Kb.Text>
          <FilesTabStatusIcon />
        </Kb.Box2>
      </Kb.Box2>
      <MainBanner />
    </Kb.SafeAreaViewTop>
  ) : (
    <Kb.SafeAreaViewTop>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.headerContainer}>
        {expanded ? (
          <Kbfs.FolderViewFilter filter={folderViewFilter} onCancel={filterDone} onChangeFilter={setFolderViewFilter} path={props.path} />
        ) : (
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.expandedTopContainer}>
            {pop ? (
              <Kb.BackButton badgeNumber={0 /* TODO KBFS-4109 */} onClick={pop} style={styles.backButton} />
            ) : null}
            <Kb.Box2 direction="horizontal" flex={1} />
            <FilesTabStatusIcon />
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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      backButton: Kb.Styles.platformStyles({
        common: {
          opacity: 1,
          paddingBottom: Kb.Styles.globalMargins.tiny,
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.tiny,
          paddingTop: Kb.Styles.globalMargins.tiny,
        },
        isAndroid: {paddingRight: Kb.Styles.globalMargins.small},
      }),
      expandedTitleContainer: {
        backgroundColor: Kb.Styles.globalColors.white,
        padding: Kb.Styles.globalMargins.tiny,
        paddingBottom: Kb.Styles.globalMargins.xsmall + Kb.Styles.globalMargins.xxtiny,
      },
      expandedTopContainer: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          backgroundColor: Kb.Styles.globalColors.white,
          paddingRight: Kb.Styles.globalMargins.tiny,
        },
        isAndroid: {height: 56},
        isIOS: {height: 44},
      }),
      filename: {marginLeft: Kb.Styles.globalMargins.xtiny},
      filesTabStatusIcon: {
        height: Kb.Styles.globalMargins.small,
        width: Kb.Styles.globalMargins.small,
      },
      headerContainer: {
        backgroundColor: Kb.Styles.globalColors.white,
        borderBottomColor: Kb.Styles.globalColors.black_10,
        borderBottomWidth: 1,
        borderStyle: 'solid',
        minHeight: 44,
      },
    }) as const
)

const NavMobileHeader = (props: Props) => (
  <Kbfs.FsDataProvider>
    <NavMobileHeaderInner {...props} />
  </Kbfs.FsDataProvider>
)

export default NavMobileHeader
