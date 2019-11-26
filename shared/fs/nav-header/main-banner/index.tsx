import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/fs'
import * as Styles from '../../../styles'

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

const Banner = (props: Props) => {
  switch (props.bannerType) {
    case Types.MainBannerType.None:
      return null
    case Types.MainBannerType.Offline:
      return (
        <Kb.Banner color="blue">
          <Kb.BannerParagraph bannerColor="blue" content="You are offline." />
        </Kb.Banner>
      )
    case Types.MainBannerType.TryingToConnect:
      return (
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.loadingLineContainer}>
          <Kb.LoadingLine />
        </Kb.Box2>
      )
    case Types.MainBannerType.OutOfSpace:
      return (
        <Kb.Banner color="red">
          <Kb.BannerParagraph
            bannerColor="red"
            content={[
              'Your ',
              Styles.isMobile ? 'phone' : 'computer',
              ' is out of space and some folders could not be properly synced. Make some space and ',
              {onClick: props.onRetry, text: 'retry the sync'},
              '.',
            ]}
          />
        </Kb.Banner>
      )
  }
}

export default Banner

const styles = Styles.styleSheetCreate(() => ({
  loadingLineContainer: Styles.platformStyles({
    isElectron: {
      position: 'relative',
      top: -1,
    },
  }),
}))
