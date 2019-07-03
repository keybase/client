import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import * as Styles from '../../styles'
import Footer from '../footer/footer'
import {isMobile} from '../../constants/platform'
import Rows from './rows/rows-container'
import {asRows as sfmiBannerAsRows} from '../banner/system-file-manager-integration-banner/container'
import {asRows as resetBannerAsRows} from '../banner/reset-banner/container'
import ConflictBanner from '../banner/conflict-banner-container'
import flags from '../../util/feature-flags'
import OfflineFolder from './offline'
import PublicReminder from '../banner/public-reminder'

type Props = {
  onAttach?: ((paths: Array<string>) => void) | null
  path: Types.Path
  routePath: I.List<string>
  shouldShowSFMIBanner: boolean
  resetBannerType: Types.ResetBannerType
  offline: boolean
}

const WithContent = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.contentContainer}>
    <PublicReminder path={props.path} />
    {/* this extra box is necessary to avoid Kb.DragAndDrop (which is fullHeight) pushes other stuff over */}
    <Kb.DragAndDrop allowFolders={true} onAttach={props.onAttach}>
      {flags.conflictResolution && <ConflictBanner path={props.path} />}
      <Rows
        path={props.path}
        routePath={props.routePath}
        headerRows={[
          ...resetBannerAsRows(props.path, props.resetBannerType),
          // only show sfmi banner at /keybase
          ...(Types.getPathLevel(props.path) === 1
            ? sfmiBannerAsRows(props.path, props.shouldShowSFMIBanner)
            : []),
        ]}
      />
    </Kb.DragAndDrop>
  </Kb.Box2>
)

const SelfReset = (props: Props) => (
  <Kb.Box2 direction="vertical" fullHeight={true}>
    <Kb.Banner
      color="red"
      text="Since you reset your account, participants have to accept to let you back in."
    />
    <Kb.Box2 direction="vertical" fullHeight={true} centerChildren={true}>
      <Kb.Icon type={isMobile ? 'icon-skull-64' : 'icon-skull-48'} />
      <Kb.Icon type="icon-access-denied-266" />
    </Kb.Box2>
  </Kb.Box2>
)

const Browser = (props: Props) => (
  <Kb.BoxGrow>
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kbfs.Errs />
      {props.resetBannerType === Types.ResetBannerNoOthersType.Self ? (
        <SelfReset {...props} />
      ) : props.offline ? (
        <OfflineFolder path={props.path} />
      ) : (
        <WithContent {...props} />
      )}
      <Footer />
    </Kb.Box2>
  </Kb.BoxGrow>
)

const styles = Styles.styleSheetCreate({
  contentContainer: {
    flex: 1,
  },
})

export default Browser
