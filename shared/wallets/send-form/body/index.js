// @flow
import * as React from 'react'
import {Box2, Divider, ProgressIndicator} from '../../../common-adapters'
import {globalStyles, styleSheetCreate} from '../../../styles'
import AssetInput from '../asset-input/container'
import Banner from '../../banner/container'
import Footer from '../footer/container'
import NoteAndMemo from '../note-and-memo/container'
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
  <Box2 fullWidth={true} fullHeight={true} direction="vertical">
    {isProcessing && <Spinner />}
    {bannerInfo && <Banner />}
    <Participants
      // TODO: Remove these, this is just to make flow happy until we integrate
      onLinkAccount={() => {}}
      onCreateNewAccount={() => {}}
      onChangeFromAccount={() => {}}
      onChangeToAccount={() => {}}
      fromAccount={{
        user: '',
        name: '',
        contents: '',
      }}
      allAccounts={[]}
    />
    <Divider />
    <AssetInput />
    <NoteAndMemo />
    <Footer onClick={onClick} />
  </Box2>
)

const styles = styleSheetCreate({
  spinnerContainer: {...globalStyles.fillAbsolute},
})

export default Body
