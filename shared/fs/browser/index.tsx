import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import * as Styles from '../../styles'
import Footer from '../footer/footer'
import {isMobile} from '../../constants/platform'
import Rows from './rows/rows-container'
import {asRows as resetBannerAsRows} from '../banner/reset-banner/container'
import ConflictBanner from '../banner/conflict-banner-container'
import flags from '../../util/feature-flags'
import OfflineFolder from './offline'
import PublicReminder from '../banner/public-reminder'
import Root from './root'

type Props = {
  onAttach?: ((paths: Array<string>) => void) | null
  path: Types.Path
  resetBannerType: Types.ResetBannerType
  offline: boolean
}

const WithContent = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.contentContainer}>
    <PublicReminder path={props.path} />
    {/* this extra box is necessary to avoid Kb.DragAndDrop (which is fullHeight) pushes other stuff over */}
    <Kb.DragAndDrop allowFolders={true} onAttach={props.onAttach || null}>
      {flags.conflictResolution && <ConflictBanner path={props.path} />}
      <Rows path={props.path} headerRows={[...resetBannerAsRows(props.path, props.resetBannerType)]} />
    </Kb.DragAndDrop>
  </Kb.Box2>
)

const SelfReset = (_: Props) => (
  <Kb.Box2 direction="vertical" fullHeight={true}>
    <Kb.Banner color="red">
      <Kb.BannerParagraph
        bannerColor="red"
        content="Since you reset your account, participants have to accept to let you back in."
      />
    </Kb.Banner>
    <Kb.Box2 direction="vertical" fullHeight={true} centerChildren={true}>
      <Kb.Icon type={isMobile ? 'icon-skull-64' : 'icon-skull-48'} />
      <Kb.Icon type="icon-access-denied-266" />
    </Kb.Box2>
  </Kb.Box2>
)

const Browser = (props: Props) =>
  props.path === Constants.defaultPath ? (
    <Root />
  ) : (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kbfs.Errs />
      {props.resetBannerType === Types.ResetBannerNoOthersType.Self ? (
        <SelfReset {...props} />
      ) : props.offline ? (
        <OfflineFolder path={props.path} />
      ) : (
        <WithContent {...props} />
      )}
      <Footer path={props.path} />
    </Kb.Box2>
  )

const styles = Styles.styleSheetCreate({
  contentContainer: {
    flex: 1,
  },
})

export default Browser
