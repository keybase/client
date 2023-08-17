import * as Kb from '../../../common-adapters'
import * as T from '../../../constants/types'
import * as Styles from '../../../styles'

type Props = {
  onRetry: () => void
  bannerType: T.FS.MainBannerType
}

const Banner = (props: Props) => {
  switch (props.bannerType) {
    case T.FS.MainBannerType.None:
      return null
    case T.FS.MainBannerType.Offline:
      return (
        <Kb.Banner color="blue">
          <Kb.BannerParagraph bannerColor="blue" content="You are offline." />
        </Kb.Banner>
      )
    case T.FS.MainBannerType.TryingToConnect:
      return (
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.loadingLineContainer}>
          <Kb.LoadingLine />
        </Kb.Box2>
      )
    case T.FS.MainBannerType.OutOfSpace:
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
