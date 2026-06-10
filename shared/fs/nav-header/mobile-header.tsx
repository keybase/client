import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Kbfs from '../common'
import type * as T from '@/constants/types'
import {useModalHeaderState} from '@/stores/modal-header'
import Actions from './actions'
import * as FS from '@/constants/fs'

/*
 *
 * Android only: iOS uses the native header (see ios-header.tsx) so its items
 * get the liquid glass treatment.
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
  const uploadIcon = Kbfs.useFilesTabUploadIcon()
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
        <Kb.Box2 direction="horizontal" fullWidth={true} centerChildren={true} gap="xtiny" style={styles.rootContainer}>
          <Kb.Text type="BodyBig">Files</Kb.Text>
          <FilesTabStatusIcon />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.SafeAreaViewTop>
  ) : (
    <Kb.SafeAreaViewTop>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.headerContainer}>
        {expanded ? (
          <Kbfs.FolderViewFilter filter={folderViewFilter} onCancel={filterDone} onChangeFilter={setFolderViewFilter} path={props.path} />
        ) : (
          <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.expandedTopContainer}>
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
      </Kb.Box2>
    </Kb.SafeAreaViewTop>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      backButton: {
        opacity: 1,
        ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
        paddingRight: Kb.Styles.globalMargins.small,
      },
      expandedTitleContainer: {
        backgroundColor: Kb.Styles.globalColors.white,
        padding: Kb.Styles.globalMargins.tiny,
        paddingBottom: Kb.Styles.globalMargins.xsmall + Kb.Styles.globalMargins.xxtiny,
      },
      rootContainer: {height: 56},
      expandedTopContainer: {
        backgroundColor: Kb.Styles.globalColors.white,
        height: 56,
        paddingRight: Kb.Styles.globalMargins.tiny,
      },
      filename: {marginLeft: Kb.Styles.globalMargins.xtiny},
      filesTabStatusIcon: Kb.Styles.size(Kb.Styles.globalMargins.small),
      headerContainer: {
        backgroundColor: Kb.Styles.globalColors.white,
        ...Kb.Styles.bottomDivider(44),
      },
    }) as const
)

const NavMobileHeader = (props: Props) => (
  <Kbfs.FsErrorProvider>
    <Kbfs.FsDataProvider>
      <NavMobileHeaderInner {...props} />
    </Kbfs.FsDataProvider>
  </Kbfs.FsErrorProvider>
)

export default NavMobileHeader
