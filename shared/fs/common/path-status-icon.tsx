import * as React from 'react'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
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
      return Kb.Styles.globalColors.blue
    case T.FS.NonUploadStaticSyncStatus.Unknown:
      return Kb.Styles.globalColors.greyDark
    case T.FS.NonUploadStaticSyncStatus.Synced:
      return Kb.Styles.globalColors.green
    case T.FS.NonUploadStaticSyncStatus.SyncError:
      return Kb.Styles.globalColors.red
    case T.FS.LocalConflictStatus:
      return Kb.Styles.globalColors.red
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

const PathStatusIcon = React.memo(function PathStatusIcon(props: Props) {
  return props.statusIcon ? (
    <Kb.WithTooltip
      tooltip={getTooltip(props.statusIcon, props.isFolder)}
      showOnPressMobile={props.showTooltipOnPressMobile}
    >
      {typeof props.statusIcon === 'number' ? (
        <Kb.Box2 direction="horizontal" style={{margin: Kb.Styles.globalMargins.xtiny}}>
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
})

const styles = Kb.Styles.styleSheetCreate(() => ({
  iconFont: {
    alignSelf: 'center',
    paddingLeft: Kb.Styles.globalMargins.xtiny,
    paddingRight: Kb.Styles.globalMargins.xtiny,
  },
  iconNonFont: Kb.Styles.platformStyles({
    common: {
      marginLeft: Kb.Styles.globalMargins.xtiny,
      marginRight: Kb.Styles.globalMargins.xtiny,
    },
    isElectron: {
      height: Kb.Styles.globalMargins.xsmall,
      width: Kb.Styles.globalMargins.xsmall,
    },
    isMobile: {
      height: Kb.Styles.globalMargins.small,
      width: Kb.Styles.globalMargins.small,
    },
  }),
  placeholder: Kb.Styles.platformStyles({
    isElectron: {
      height: Kb.Styles.globalMargins.xsmall + Kb.Styles.globalMargins.xtiny,
      width: Kb.Styles.globalMargins.xsmall + Kb.Styles.globalMargins.xtiny,
    },
    isMobile: {
      height: Kb.Styles.globalMargins.small + Kb.Styles.globalMargins.xtiny,
      width: Kb.Styles.globalMargins.small + Kb.Styles.globalMargins.xtiny,
    },
  }),
}))

export default PathStatusIcon
