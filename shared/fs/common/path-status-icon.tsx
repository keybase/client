import * as T from '../../constants/types'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import PieSlice from './pie-slice'
import UploadIcon from './upload-icon'

type Props = {
  isTlfType?: boolean
  isFolder: boolean
  statusIcon?: T.FS.PathStatusIcon
  showTooltipOnPressMobile?: boolean
}

function getIcon(status: T.FS.LocalConflictStatusType | T.FS.NonUploadStaticSyncStatus): Kb.IconType {
  switch (status) {
    case T.FS.NonUploadStaticSyncStatus.AwaitingToSync:
      return 'iconfont-clock'
    case T.FS.NonUploadStaticSyncStatus.OnlineOnly:
      return 'iconfont-cloud'
    case T.FS.NonUploadStaticSyncStatus.Synced:
      return 'iconfont-success'
    case T.FS.NonUploadStaticSyncStatus.SyncError:
      return 'iconfont-exclamation'
    case T.FS.LocalConflictStatus:
      return 'iconfont-exclamation'
    case T.FS.NonUploadStaticSyncStatus.Unknown:
      return 'iconfont-circle'
  }
}

function getColor(status: T.FS.LocalConflictStatusType | T.FS.NonUploadStaticSyncStatus) {
  switch (status) {
    case T.FS.NonUploadStaticSyncStatus.AwaitingToSync:
    case T.FS.NonUploadStaticSyncStatus.OnlineOnly:
      return Styles.globalColors.blue
    case T.FS.NonUploadStaticSyncStatus.Unknown:
      return Styles.globalColors.greyDark
    case T.FS.NonUploadStaticSyncStatus.Synced:
      return Styles.globalColors.green
    case T.FS.NonUploadStaticSyncStatus.SyncError:
      return Styles.globalColors.red
    case T.FS.LocalConflictStatus:
      return Styles.globalColors.red
  }
}

function getTooltip(statusIcon: T.FS.PathStatusIcon, isFolder: boolean): string {
  if (typeof statusIcon === 'number') {
    return 'Syncing ' + Math.floor(statusIcon * 100) + '%...'
  }

  switch (statusIcon) {
    case T.FS.NonUploadStaticSyncStatus.AwaitingToSync:
      return 'Waiting to sync'
    case T.FS.UploadIcon.AwaitingToUpload:
      return 'Local ' + (isFolder ? 'folder' : 'file') + '. Upload will start once you get back online.'
    case T.FS.UploadIcon.Uploading:
      return 'Uploading...'
    case T.FS.UploadIcon.UploadingStuck:
      return 'Stuck in conflict resolution. Upload will start once you resolve conflict.'
    case T.FS.NonUploadStaticSyncStatus.OnlineOnly:
      return 'Online only'
    case T.FS.NonUploadStaticSyncStatus.Synced:
      return 'Synced'
    case T.FS.NonUploadStaticSyncStatus.SyncError:
      return (isFolder ? 'Folder' : 'File') + " couldn't sync"
    case T.FS.LocalConflictStatus:
      return 'Local view of a conflicted folder.'
    case T.FS.NonUploadStaticSyncStatus.Unknown:
      return 'Unknown sync state'
  }
}

const PathStatusIcon = (props: Props) =>
  props.statusIcon ? (
    <Kb.WithTooltip
      tooltip={getTooltip(props.statusIcon, props.isFolder)}
      showOnPressMobile={props.showTooltipOnPressMobile}
    >
      {typeof props.statusIcon === 'number' ? (
        <Kb.Box2 direction="horizontal" style={{margin: Styles.globalMargins.xtiny}}>
          <PieSlice degrees={360 * props.statusIcon} animated={true} />
        </Kb.Box2>
      ) : props.statusIcon === T.FS.UploadIcon.AwaitingToUpload ||
        props.statusIcon === T.FS.UploadIcon.Uploading ||
        props.statusIcon === T.FS.UploadIcon.UploadingStuck ? (
        <UploadIcon uploadIcon={props.statusIcon} style={styles.iconNonFont} />
      ) : (
        <Kb.Icon
          fixOverdraw={true}
          type={getIcon(props.statusIcon)}
          sizeType="Small"
          style={styles.iconFont}
          color={getColor(props.statusIcon)}
        />
      )}
    </Kb.WithTooltip>
  ) : props.isTlfType ? (
    <Kb.Icon fixOverdraw={true} type="iconfont-root" sizeType="Small" style={styles.iconFont} />
  ) : (
    <Kb.Box style={styles.placeholder} />
  )

const styles = Styles.styleSheetCreate(() => ({
  iconFont: {
    paddingLeft: Styles.globalMargins.xtiny,
    paddingRight: Styles.globalMargins.xtiny,
  },
  iconNonFont: Styles.platformStyles({
    common: {
      marginLeft: Styles.globalMargins.xtiny,
      marginRight: Styles.globalMargins.xtiny,
    },
    isElectron: {
      height: Styles.globalMargins.xsmall,
      width: Styles.globalMargins.xsmall,
    },
    isMobile: {
      height: Styles.globalMargins.small,
      width: Styles.globalMargins.small,
    },
  }),
  placeholder: Styles.platformStyles({
    isElectron: {
      height: Styles.globalMargins.xsmall + Styles.globalMargins.xtiny,
      width: Styles.globalMargins.xsmall + Styles.globalMargins.xtiny,
    },
    isMobile: {
      height: Styles.globalMargins.small + Styles.globalMargins.xtiny,
      width: Styles.globalMargins.small + Styles.globalMargins.xtiny,
    },
  }),
}))

export default PathStatusIcon
