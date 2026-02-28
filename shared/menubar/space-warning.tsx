import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'

type Props = {
  hidden: boolean
  onClose: () => void
  onRetry: () => void
  diskSpaceStatus: T.FS.DiskSpaceStatus
}

const SpaceWarning = (props: Props) => {
  const display =
    props.diskSpaceStatus === T.FS.DiskSpaceStatus.Error ||
    (props.diskSpaceStatus === T.FS.DiskSpaceStatus.Warning && !props.hidden)
  const color = props.diskSpaceStatus === T.FS.DiskSpaceStatus.Warning ? 'blue' : 'red'
  return display ? (
    <Kb.Banner
      {...(props.diskSpaceStatus === T.FS.DiskSpaceStatus.Warning ? {onClose: props.onClose} : {})}
      color={color}
      narrow={true}
      style={{minHeight: 50}}
    >
      <Kb.BannerParagraph
        bannerColor={color}
        content={[
          props.diskSpaceStatus === T.FS.DiskSpaceStatus.Warning
            ? 'You have less than 1 GB of storage space. Make some space, or unsync some folders. '
            : 'You are out of storage space. Unsync some folders, or make some space then ',
          {onClick: props.onRetry, text: 'retry the sync'},
          '.',
        ]}
      />
    </Kb.Banner>
  ) : null
}

export default SpaceWarning
