import * as React from 'react'
import {Box2} from './box'
import Image from './image'
import ProgressIndicator from './progress-indicator'
import * as Styles from '../styles'
import {Banner, BannerParagraph} from './banner'
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
    <Box2 direction="vertical" fullHeight={true} fullWidth={true} gap="small" style={styles.container}>
      {!!mapSrc && <Image src={mapSrc} style={{height, width}} onLoad={onLoad} />}
      {!mapLoaded && <ProgressIndicator style={styles.loading} />}
      {/* 
      // @ts-ignore  */}
      <Banner color="white" style={styles.banner}>
        <BannerParagraph
          bannerColor="grey"
          content={[
            'Your location is protected. ',
            {text: 'Learn more', onClick: () => openURL('https://keybase.io/docs/chat/location')},
          ]}
        />
      </Banner>
    </Box2>
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
    } as const)
)
