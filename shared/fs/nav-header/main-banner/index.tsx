import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/fs'
import {isMobile} from '../../../constants/platform'

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
    <Kb.Banner color="blue">
      <Kb.BannerParagraph bannerColor="blue" content="You are offline." />
    </Kb.Banner>
  ) : (
    <Kb.Banner color="red">
      <Kb.BannerParagraph
        bannerColor="red"
        content={[
          'Your ',
          isMobile ? 'phone' : 'computer',
          ' is out of space and some folders could not be properly synced. Make some space and ',
          {onClick: props.onRetry, text: 'retry the sync'},
          '.',
        ]}
      />
    </Kb.Banner>
  )

export default Banner
