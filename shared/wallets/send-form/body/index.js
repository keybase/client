// @flow
import * as React from 'react'
import {Box2, Divider, ProgressIndicator} from '../../../common-adapters'
import {globalStyles, styleSheetCreate} from '../../../styles'
import AssetInput from '../asset-input/container'
import Banner from '../banner/container'
import Footer from '../footer/container'
import Memo from '../memo/container'
import Note from '../note/container'
import Participants from '../participants/container'

type Props = {
  bannerInfo?: string,
  isProcessing?: boolean,
  onClick: Function,
}

const Spinner = () => (
  <Box2 direction="vertical" style={styles.spinnerContainer}>
    <ProgressIndicator type="Large" />
  </Box2>
)

const Body = ({bannerInfo, isProcessing, onClick}: Props) => (
  <Box2 fullWidth={true} direction="vertical">
    {isProcessing && <Spinner />}
    {bannerInfo && <Banner />}
    <Participants />
    <Divider />
    <AssetInput />
    <Memo />
    <Note />
    <Footer onClick={onClick} />
  </Box2>
)

const styles = styleSheetCreate({
  spinnerContainer: {...globalStyles.fillAbsolute},
})

export default Body
