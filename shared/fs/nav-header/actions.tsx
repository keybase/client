import * as C from '@/constants'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Kbfs from '../common'
import {navigateAppend} from '@/constants/router'
import type {RootRouteProps} from '@/router-v2/route-params'
import {useRoute} from '@react-navigation/native'
import * as FS from '@/stores/fs'
import {useFSState} from '@/stores/fs'

type Props = {
  folderViewFilter?: string
  onTriggerFilterMobile: () => void
  path: T.FS.Path
}

const FsNavHeaderRightActions = (props: Props) => {
  const route = useRoute<RootRouteProps<'fsRoot'>>()
  const softErrors = useFSState(s => s.softErrors)
  const lastClosedPublicBannerTlf = route.params?.lastClosedPublicBannerTlf
  const setFolderViewFilter = React.useCallback(
    (folderViewFilter?: string) =>
      navigateAppend(
        {name: 'fsRoot', params: {folderViewFilter, lastClosedPublicBannerTlf, path: props.path}},
        true
      ),
    [lastClosedPublicBannerTlf, props.path]
  )
  const hasSoftError = !!FS.getSoftError(softErrors, props.path)
  React.useEffect(() => {
    !Kb.Styles.isMobile && setFolderViewFilter() // mobile is handled in mobile-header.tsx
  }, [setFolderViewFilter, props.path]) // clear if path changes or it's a new layer of mount

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
