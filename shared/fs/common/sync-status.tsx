import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import PieSlice from './pie-slice'
import UploadIcon from './upload-icon'

type Props = {
  isTlfType?: boolean
  isFolder: boolean
  syncStatus?: Types.SyncStatus
}

function getIcon(status: Types.NonUploadStaticSyncStatus): Kb.IconType {
  switch (status) {
    case Types.NonUploadStaticSyncStatus.AwaitingToSync:
      return 'iconfont-time'
    case Types.NonUploadStaticSyncStatus.OnlineOnly:
      return 'iconfont-cloud'
    case Types.NonUploadStaticSyncStatus.Synced:
      return 'iconfont-success'
    case Types.NonUploadStaticSyncStatus.SyncError:
      return 'iconfont-exclamation'
    case Types.NonUploadStaticSyncStatus.Unknown:
      return 'iconfont-question-mark'
  }
}

function getColor(status: Types.NonUploadStaticSyncStatus) {
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
  }
}

function getTooltip(syncStatus: Types.SyncStatus, isFolder: boolean): string {
  if (typeof syncStatus === 'number') {
    return 'Syncing ' + Math.floor(syncStatus * 100) + '%...'
  }

  switch (syncStatus) {
    case Types.NonUploadStaticSyncStatus.AwaitingToSync:
      return 'Waiting to sync'
    case Types.UploadIcon.AwaitingToUpload:
      return 'Local ' + (isFolder ? 'folder' : 'file') + '. Upload will start once you get back online.'
    case Types.UploadIcon.Uploading:
      return 'Uploading...'
    case Types.UploadIcon.UploadingStuck:
      return 'Stuck in conflict resolution. Upload will start once you resolve confliction.'
    case Types.NonUploadStaticSyncStatus.OnlineOnly:
      return 'Online only'
    case Types.NonUploadStaticSyncStatus.Synced:
      return 'Synced'
    case Types.NonUploadStaticSyncStatus.SyncError:
      return (isFolder ? 'Folder' : 'File') + " couldn't sync"
    case Types.NonUploadStaticSyncStatus.Unknown:
      return 'Unknown sync state'
  }
}

const SyncStatus = (props: Props) =>
  props.syncStatus ? (
    <Kb.WithTooltip tooltip={getTooltip(props.syncStatus, props.isFolder)}>
      {typeof props.syncStatus === 'number' ? (
        <Kb.Box2 direction="horizontal" style={{margin: Styles.globalMargins.xtiny}}>
          <PieSlice degrees={360 * props.syncStatus} animated={true} />
        </Kb.Box2>
      ) : props.syncStatus === Types.UploadIcon.AwaitingToUpload ||
        props.syncStatus === Types.UploadIcon.Uploading ||
        props.syncStatus === Types.UploadIcon.UploadingStuck ? (
        <UploadIcon uploadIcon={props.syncStatus} style={styles.iconNonFont} />
      ) : (
        <Kb.Icon
          type={getIcon(props.syncStatus)}
          sizeType="Small"
          style={styles.iconFont}
          color={getColor(props.syncStatus)}
        />
      )}
    </Kb.WithTooltip>
  ) : props.isTlfType ? (
    <Kb.Icon type="iconfont-root" sizeType="Small" padding="xtiny" />
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

export default SyncStatus
