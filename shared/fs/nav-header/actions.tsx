import * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Kbfs from '../common'
import {navigateAppend} from '@/constants/router'
import * as FS from '@/stores/fs'
import {useFSState} from '@/stores/fs'

type Props = {
  folderViewFilter?: string
  lastClosedPublicBannerTlf?: string
  onTriggerFilterMobile: () => void
  path: T.FS.Path
}

const FsNavHeaderRightActions = (props: Props) => {
  const softErrors = useFSState(s => s.softErrors)
  const setFolderViewFilter = React.useCallback(
    (folderViewFilter?: string) =>
      navigateAppend(
        {
          name: 'fsRoot',
          params: {folderViewFilter, lastClosedPublicBannerTlf: props.lastClosedPublicBannerTlf, path: props.path},
        },
        true
      ),
    [props.lastClosedPublicBannerTlf, props.path]
  )
  const hasSoftError = !!FS.getSoftError(softErrors, props.path)

  return !hasSoftError ? (
    <Kb.Box2 direction="horizontal" style={styles.container} centerChildren={true}>
      <Kbfs.UploadButton path={props.path} style={styles.uploadButton} />
      {Kb.Styles.isMobile ? (
        <Kbfs.FolderViewFilterIcon path={props.path} onClick={props.onTriggerFilterMobile} />
      ) : (
        <Kbfs.FolderViewFilter
          filter={props.folderViewFilter}
          onChangeFilter={setFolderViewFilter}
          path={props.path}
          style={styles.folderViewFilter}
        />
      )}
      <Kbfs.OpenInSystemFileManager path={props.path} />
      <Kbfs.PathItemAction
        path={props.path}
        clickable={{type: 'icon'}}
        initView={T.FS.PathItemActionMenuView.Root}
        mode="screen"
      />
    </Kb.Box2>
  ) : null
}

export default FsNavHeaderRightActions

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.windowDraggingClickable,
          height: 28,
          // Supposed to be small, but icons already have padding
          paddingRight: Kb.Styles.globalMargins.tiny,
        },
      }),
      folderViewFilter: {
        marginRight: Kb.Styles.globalMargins.tiny,
        width: 140,
      },
      uploadButton: Kb.Styles.platformStyles({
        isElectron: {
          marginLeft: Kb.Styles.globalMargins.tiny,
          marginRight: Kb.Styles.globalMargins.tiny,
        },
      }),
    }) as const
)
