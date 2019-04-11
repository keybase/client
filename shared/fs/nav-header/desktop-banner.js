// @flow
import {namedConnect} from '../../util/container'
import * as Kb from '../../common-adapters'
import * as React from 'react'
import flags from '../../util/feature-flags'

type BannerType = 'none' | 'offline'
type Props = {|
  bannerType: BannerType,
|}

const Banner = (props: Props) =>
  props.bannerType === 'offline' && <Kb.Banner text="You are offline." color="blue" />

const mapStateToProps = state => ({
  kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
})

const mergeProps = (s, d, o) => ({
  bannerType: flags.kbfsOfflineMode && !s.kbfsDaemonStatus.online ? 'offline' : 'none',
})

export default namedConnect<{||}, _, _, _, _>(mapStateToProps, () => ({}), mergeProps, 'NavBannerDesktop')(
  Banner
)
