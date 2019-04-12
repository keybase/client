// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import PieSlice from './pie-slice'

type Props = {
  status: Types.SyncStatus,
  folder: boolean,
}

function getIcon(props: Props): Kb.IconType {
  switch (props.status) {
    case 'awaiting-to-sync':
      return 'iconfont-time'
    case 'awaiting-to-upload':
    case 'uploading':
      return 'iconfont-upload'
    case 'online-only':
      return 'iconfont-cloud'
    case 'synced':
      return 'iconfont-proof-good'
    case 'sync-error':
      return 'iconfont-exclamation'
    default:
      // This case should never be reached.
      return 'iconfont-question-mark'
  }
}

function getColor(props: Props) {
  switch (props.status) {
    case 'awaiting-to-sync':
    case 'online-only':
    case 'uploading':
      return Styles.globalColors.blue
    case 'awaiting-to-upload':
      return Styles.globalColors.grey
    case 'synced':
      return Styles.globalColors.green
    case 'sync-error':
      return Styles.globalColors.red
    default:
      // This case should never be reached.
      return Styles.globalColors.red
  }
}

function getTooltip(props: Props): string {
  switch (props.status) {
    case 'awaiting-to-sync':
      return 'Waiting to sync'
    case 'awaiting-to-upload':
      return 'Local ' + (props.folder ? 'folder' : 'file') + '. Upload will start once you get back online.'
    case 'uploading':
      return 'Uploading...'
    case 'online-only':
      return 'Online only'
    case 'synced':
      return 'Synced'
    case 'sync-error':
      return (props.folder ? 'Folder' : 'File') + " couldn't sync"
    default:
      if (typeof props.status === 'number') {
        return 'Syncing ' + Math.floor(props.status * 100) + '%...'
      }
      return 'Unknown sync state'
  }
}

// TODO: make syncing state actually animate
const SyncStatus = (props: Props) => (
  <Kb.WithTooltip text={getTooltip(props)}>
    {typeof props.status === 'number' ? (
      <PieSlice degrees={360 * props.status} animated={true} />
    ) : (
      <Kb.Icon type={getIcon(props)} sizeType={'Small'} color={getColor(props)} />
    )}
  </Kb.WithTooltip>
)

export default SyncStatus
