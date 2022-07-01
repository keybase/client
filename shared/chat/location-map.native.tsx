import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import openURL from '../util/open-url'

type Props = {
  height: number
  mapSrc: string
  onLoad?: () => void
  width: number
}

const LocationMap = (props: Props) => {
  const {height, mapSrc, width} = props
  const [mapLoaded, setMapLoaded] = React.useState(false)
  const onLoad = () => {
    setMapLoaded(true)
    !!props.onLoad && props.onLoad()
  }
  return (
    <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} gap="small" style={styles.container}>
      {!!mapSrc && (
        <Kb.NativeFastImage
          source={{uri: mapSrc}}
          style={{height, width}}
          onLoad={onLoad}
          resizeMode="cover"
        />
      )}
      {!mapLoaded && <Kb.ProgressIndicator style={styles.loading} />}
      <Kb.Banner color="white" style={styles.banner}>
        <Kb.BannerParagraph
          bannerColor="white"
          content={[
            'Your location is protected. ',
            {onClick: () => openURL('https://book.keybase.io/docs/chat/location'), text: 'Learn more'},
          ]}
        />
      </Kb.Banner>
    </Kb.Box2>
  )
}

export default LocationMap

const styles = Styles.styleSheetCreate(
  () =>
    ({
      banner: {
        backgroundColor: Styles.globalColors.white,
        borderBottomWidth: 1,
        borderColor: Styles.globalColors.black_10,
        left: 0,
        position: 'absolute',
        top: 0,
      },
      container: {
        ...Styles.globalStyles.fillAbsolute,
        justifyContent: 'center',
      },
      learn: {
        color: Styles.globalColors.blueDark,
      },
      loading: {
        bottom: '50%',
        left: '50%',
        marginBottom: -12,
        marginLeft: -12,
        marginRight: -12,
        marginTop: -12,
        position: 'absolute',
        right: '50%',
        top: '50%',
        width: 24,
      },
      mapImage: Styles.platformStyles({
        isTablet: {
          resizeMode: 'cover',
        },
      }),
    } as const)
)
