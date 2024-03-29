import * as React from 'react'
import * as Kb from '@/common-adapters'
import openURL from '@/util/open-url'

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
    <Kb.Box2 direction="vertical" style={styles.outer}>
      <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true} gap="small" style={styles.container}>
        {!!mapSrc && <Kb.Image2 src={mapSrc} style={{height, width}} onLoad={onLoad} />}
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
    </Kb.Box2>
  )
}

export default LocationMap

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      banner: {
        backgroundColor: Kb.Styles.globalColors.white,
        borderBottomWidth: 1,
        borderColor: Kb.Styles.globalColors.black_10,
        left: 0,
        position: 'absolute',
        top: 0,
      },
      container: {
        ...Kb.Styles.globalStyles.fillAbsolute,
        alignItems: 'center',
        justifyContent: 'center',
      },
      learn: {
        color: Kb.Styles.globalColors.blueDark,
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
      outer: {
        height: 300,
        width: 300,
      },
    }) as const
)
