import * as React from 'react'
import * as Kb from '../common-adapters'
import * as FsTypes from '../constants/types/fs'

type Props = {
  hidden: boolean
  onClose: () => void
  onRetry: () => void
  diskSpaceStatus: FsTypes.DiskSpaceStatus
}

const SpaceWarning = (props: Props) => {
  const display = props.diskSpaceStatus === 'error' || (props.diskSpaceStatus === 'warning' && !props.hidden)
  const color = props.diskSpaceStatus === 'warning' ? 'blue' : 'red'
  return display ? (
    <Kb.Banner
      {...(props.diskSpaceStatus === 'warning' ? {onClose: props.onClose} : {})}
      color={color}
      narrow={true}
      style={{minHeight: 50}}
    >
      <Kb.BannerParagraph
        bannerColor={color}
        content={[
          props.diskSpaceStatus === 'warning'
            ? 'You have less than 1 GB of storage space. Make some space, or unsync some folders. '
            : 'You are out of storage space. Unsync some folders, or make some space then ',
          !!props.onRetry && {onClick: props.onRetry, text: 'retry the sync'},
          '.',
        ]}
      />
    </Kb.Banner>
  ) : null
}

export default SpaceWarning
