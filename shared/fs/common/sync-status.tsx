import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import PieSlice from './pie-slice'
import * as Flow from '../../util/flow'

type Props = {
  // This is a bug in eslint, it believes that SyncStatus is not yet defined
  // and so Types.SyncStatus isn't either.
  // eslint-disable-next-line
  status: Types.SyncStatus
  folder: boolean
}

function getIcon(status: Types.SyncStatusStatic): Kb.IconType {
  switch (status) {
    case Types.SyncStatusStatic.AwaitingToSync:
      return 'iconfont-time'
    case Types.SyncStatusStatic.AwaitingToUpload:
    case Types.SyncStatusStatic.Uploading:
      return 'iconfont-upload'
    case Types.SyncStatusStatic.OnlineOnly:
      return 'iconfont-cloud'
    case Types.SyncStatusStatic.Synced:
      return 'iconfont-success'
    case Types.SyncStatusStatic.SyncError:
      return 'iconfont-exclamation'
    case Types.SyncStatusStatic.Unknown:
      return 'iconfont-question-mark'
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(status)
      return 'iconfont-question-mark'
  }
}

function getColor(status: Types.SyncStatusStatic) {
  switch (status) {
    case Types.SyncStatusStatic.AwaitingToSync:
    case Types.SyncStatusStatic.OnlineOnly:
    case Types.SyncStatusStatic.Uploading:
      return Styles.globalColors.blue
    case Types.SyncStatusStatic.AwaitingToUpload:
    case Types.SyncStatusStatic.Unknown:
      return Styles.globalColors.greyDark
    case Types.SyncStatusStatic.Synced:
      return Styles.globalColors.green
    case Types.SyncStatusStatic.SyncError:
      return Styles.globalColors.red
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(status)
      return Styles.globalColors.greyDark
  }
}

function getTooltip(props: Props): string {
  if (typeof props.status === 'number') {
    return 'Syncing ' + Math.floor(props.status * 100) + '%...'
  }

  switch (props.status) {
    case Types.SyncStatusStatic.AwaitingToSync:
      return 'Waiting to sync'
    case Types.SyncStatusStatic.AwaitingToUpload:
      return 'Local ' + (props.folder ? 'folder' : 'file') + '. Upload will start once you get back online.'
    case Types.SyncStatusStatic.Uploading:
      return 'Uploading...'
    case Types.SyncStatusStatic.OnlineOnly:
      return 'Online only'
    case Types.SyncStatusStatic.Synced:
      return 'Synced'
    case Types.SyncStatusStatic.SyncError:
      return (props.folder ? 'Folder' : 'File') + " couldn't sync"
    case Types.SyncStatusStatic.Unknown:
      return 'Unknown sync state'
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(props.status)
      return 'Unknown sync state'
  }
}

const SyncStatus = (props: Props) => (
  <Kb.WithTooltip text={getTooltip(props)}>
    {typeof props.status === 'number' ? (
      <Kb.Box2 direction="horizontal" style={{margin: Styles.globalMargins.xtiny}}>
        <PieSlice degrees={360 * props.status} animated={true} />
      </Kb.Box2>
    ) : (
      <Kb.Icon type={getIcon(props.status)} sizeType="Small" padding="xtiny" color={getColor(props.status)} />
    )}
  </Kb.WithTooltip>
)

export default SyncStatus
