// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import FolderHeader from '../header/container'
import Footer from '../footer/footer'
import {isMobile} from '../../constants/platform'
import Rows from '../row/rows-container'
import DropTarget from './drop-target'
import {asRows as sfmiBannerAsRows} from '../banner/system-file-manager-integration-banner/container'
import {asRows as resetBannerAsRows} from '../banner/reset-banner/container'

type Props = {|
  onAttach?: ?(paths: Array<string>) => void,
  path: Types.Path,
  routePath: I.List<string>,
  shouldShowSFMIBanner: boolean,
  resetBannerType: Types.ResetBannerType,
|}

const WithContent = (props: Props) => (
  <DropTarget onAttach={props.onAttach}>
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
  </DropTarget>
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

const Folder = (props: Props) => (
  <Kb.BoxGrow>
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <FolderHeader path={props.path} routePath={props.routePath} />
      <Kbfs.Errs />
      <Kb.Divider />
      {props.resetBannerType === 'self' ? <SelfReset {...props} /> : <WithContent {...props} />}
      <Footer />
    </Kb.Box2>
  </Kb.BoxGrow>
)

export default Folder
