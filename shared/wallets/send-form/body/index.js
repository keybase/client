// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import AssetInput from '../asset-input/container'
import Banner from '../../banner'
import Footer from '../footer/container'
import NoteAndMemo from '../note-and-memo/container'
import Participants from '../participants/container'
import type {Banner as BannerType} from '../../../constants/types/wallets'

type Props = {
  isRequest: boolean,
  banners: Array<BannerType>,
  isProcessing?: boolean,
  onLinkAccount: () => void,
  onCreateNewAccount: () => void,
}

const Spinner = () => (
  <Kb.Box2 direction="vertical" style={styles.spinnerContainer}>
    <Kb.ProgressIndicator type="Large" />
  </Kb.Box2>
)

const Body = (props: Props) => (
  <Kb.Box2 fullWidth={true} direction="vertical" style={styles.container}>
    <Kb.ScrollView style={styles.scrollView}>
      {props.isProcessing && <Spinner />}
      {props.banners.map(banner => (
        <Banner key={banner.bannerText} background={banner.bannerBackground} text={banner.bannerText} />
      ))}
      <Participants onLinkAccount={props.onLinkAccount} onCreateNewAccount={props.onCreateNewAccount} />
      <AssetInput />
      <Kb.Divider />
      <NoteAndMemo />
    </Kb.ScrollView>
    <Footer isRequest={props.isRequest} />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: {
    flexGrow: 1,
  },
  scrollView: Styles.platformStyles({
    common: {
      width: '100%',
      flexGrow: 1,
    },
    isElectron: {minHeight: '100%'},
  }),
  spinnerContainer: {...Styles.globalStyles.fillAbsolute},
})

export default Body
