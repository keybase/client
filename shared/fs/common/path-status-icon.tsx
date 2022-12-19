import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import PieSlice from './pie-slice'
import UploadIcon from './upload-icon'

type Props = {
  isTlfType?: boolean
  isFolder: boolean
  statusIcon?: Types.PathStatusIcon
  showTooltipOnPressMobile?: boolean
}

function getIcon(status: Types.LocalConflictStatusType | Types.NonUploadStaticSyncStatus): Kb.IconType {
  switch (status) {
    case Types.NonUploadStaticSyncStatus.AwaitingToSync:
      return 'iconfont-clock'
    case Types.NonUploadStaticSyncStatus.OnlineOnly:
      return 'iconfont-cloud'
    case Types.NonUploadStaticSyncStatus.Synced:
      return 'iconfont-success'
    case Types.NonUploadStaticSyncStatus.SyncError:
      return 'iconfont-exclamation'
    case Types.LocalConflictStatus:
      return 'iconfont-exclamation'
    case Types.NonUploadStaticSyncStatus.Unknown:
      return 'iconfont-circle'
  }
}

function getColor(status: Types.LocalConflictStatusType | Types.NonUploadStaticSyncStatus) {
  switch (status) {
    case Types.NonUploadStaticSyncStatus.AwaitingToSync:
    case Types.NonUploadStaticSyncStatus.OnlineOnly:
      return Styles.globalColors.blue
    case Types.NonUploadStaticSyncStatus.Unknown:
      return Styles.globalColors.greyDark
    case Types.NonUploadStaticSyncStatus.Synced:
      return Styles.globalColors.green
    case Types.NonUploadStaticSyncStatus.SyncError:
      return Styles.globalColors.red
    case Types.LocalConflictStatus:
      return Styles.globalColors.red
  }
}

function getTooltip(statusIcon: Types.PathStatusIcon, isFolder: boolean): string {
  if (typeof statusIcon === 'number') {
    return 'Syncing ' + Math.floor(statusIcon * 100) + '%...'
  }

  switch (statusIcon) {
    case Types.NonUploadStaticSyncStatus.AwaitingToSync:
      return 'Waiting to sync'
    case Types.UploadIcon.AwaitingToUpload:
      return 'Local ' + (isFolder ? 'folder' : 'file') + '. Upload will start once you get back online.'
    case Types.UploadIcon.Uploading:
      return 'Uploading...'
    case Types.UploadIcon.UploadingStuck:
      return 'Stuck in conflict resolution. Upload will start once you resolve conflict.'
    case Types.NonUploadStaticSyncStatus.OnlineOnly:
      return 'Online only'
    case Types.NonUploadStaticSyncStatus.Synced:
      return 'Synced'
    case Types.NonUploadStaticSyncStatus.SyncError:
      return (isFolder ? 'Folder' : 'File') + " couldn't sync"
    case Types.LocalConflictStatus:
      return 'Local view of a conflicted folder.'
    case Types.NonUploadStaticSyncStatus.Unknown:
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
      ) : props.statusIcon === Types.UploadIcon.AwaitingToUpload ||
        props.statusIcon === Types.UploadIcon.Uploading ||
        props.statusIcon === Types.UploadIcon.UploadingStuck ? (
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
