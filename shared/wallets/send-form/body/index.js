// @flow
import * as React from 'react'
import {Box2, Divider, ProgressIndicator} from '../../../common-adapters'
import {globalStyles, styleSheetCreate} from '../../../styles'
import AssetInput from '../asset-input/index'
import Banner from '../../banner/container'
import Footer from '../footer/index'
import Memo from '../memo/container'
import Note from '../note/container'
import Participants from '../participants/container'

type Props = {
  bannerInfo?: string,
  isProcessing?: boolean,
  onChangeAddress: () => void,
  onChangeAmount: () => void,
  onClickSend: () => void,
  targetType?: 'keybaseUser' | 'anotherWallet' | 'stellarAddress',
}

const Spinner = () => (
  <Box2 direction="vertical" style={styles.spinnerContainer}>
    <ProgressIndicator type="Large" />
  </Box2>
)

const Body = (props: Props) => {
  console.warn('in Body', props)
  return (
  <Box2 fullWidth={true} direction="vertical">
    {props.isProcessing && <Spinner />}
    {props.bannerInfo && <Banner />}
    <Participants onChangeAddress={props.onChangeAddress} targetType={props.targetType} />
    <Divider />
    <AssetInput displayUnit='XLM' inputPlaceholder='0.00' onChangeAmount={props.onChangeAmount} />
    <Memo />
    <Note />
    <Footer onClickSend={props.onClickSend} />
  </Box2>
)
}
const styles = styleSheetCreate({
  spinnerContainer: {...globalStyles.fillAbsolute},
})

export default Body
