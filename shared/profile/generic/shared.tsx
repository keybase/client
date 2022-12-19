import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import type {SiteIconSet} from '../../constants/types/tracker2'

export const ProofSuccessIcon = <Kb.Icon type="icon-proof-success" color={Styles.globalColors.green} />
export const MastadonIcon = (
  <Kb.Icon type="iconfont-identity-mastodon" colorOverride="#2b90d9" fontSize={64} />
)

const siteIconToSrcSet = (siteIcon: SiteIconSet) =>
  `-webkit-image-set(${siteIcon
    .slice()
    .sort((a, b) => a.width - b.width)
    .map((si, idx) => `url(${si.path}) ${idx + 1}x`)
    .join(', ')})`
const siteIconToNativeSrcSet = (siteIcon: SiteIconSet) =>
  siteIcon.map(si => ({height: si.width, uri: si.path, width: si.width}))

type SiteIconProps = {
  full: boolean
  set: SiteIconSet
  style?: Styles.StylesCrossPlatform
}

export const SiteIcon = (props: SiteIconProps) => {
  const style = props.full ? siteIconStyles.siteIconFull : siteIconStyles.siteIcon
  return Styles.isMobile ? (
    <Kb.RequireImage
      src={siteIconToNativeSrcSet(props.set)}
      style={Styles.collapseStyles([style, props.style])}
    />
  ) : (
    <Kb.Box
      style={Styles.collapseStyles([
        style,
        props.style,
        {backgroundImage: siteIconToSrcSet(props.set)},
      ] as any)}
    />
  )
}

const siteIconStyles = Styles.styleSheetCreate(() => ({
  siteIcon: Styles.platformStyles({
    common: {
      flexShrink: 0,
    },
    isElectron: {
      backgroundSize: 'contain',
      height: 16,
      width: 16,
    },
    isMobile: {
      height: 18,
      width: 18,
    },
  }),
  siteIconFull: Styles.platformStyles({
    common: {
      flexShrink: 0,
    },
    isElectron: {
      backgroundSize: 'contain',
      height: 48,
      width: 48,
    },
    isMobile: {
      height: 64,
      width: 64,
    },
  }),
}))
