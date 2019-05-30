import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/fs'

// /*
//  * This banner is used as part of a List2 in fs/row/rows.js, so it's important
//  * to keep height stable, thus all the height/minHeight/maxHeight in styles.
//  * Please make sure the height is still calculated in getHeight when layout
//  * changes.
//  *
//  */
// export const getHeight = (bannerType: Types.MainBannerType): number =>
//   bannerType === 'out-of-space' ? 56 : bannerType === 'offline' ? 24 : 0

type Props = {
  onRetry: () => void
  bannerType: Types.MainBannerType
}

const Banner = (props: Props) =>
  props.bannerType === Types.MainBannerType.None ? null : props.bannerType ===
    Types.MainBannerType.Offline ? (
    <Kb.Banner text="You are offline." color="blue" />
  ) : (
    <Kb.Banner
      text="You are out of storage space and some folders could not be properly synced. Make some space and"
      color="red"
      actions={[{onClick: props.onRetry, title: 'retry the sync.'}]}
    />
  )

export default Banner
