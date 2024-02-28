import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'

const siteIconToSrcSet = (siteIcon: T.Tracker.SiteIconSet) =>
  `-webkit-image-set(${siteIcon
    .slice()
    .sort((a, b) => a.width - b.width)
    .map((si, idx) => `url(${si.path}) ${idx + 1}x`)
    .join(', ')})`
const siteIconToNativeSrcSet = (siteIcon: T.Tracker.SiteIconSet) =>
  siteIcon.map(si => ({height: si.width, uri: si.path, width: si.width}))

type SiteIconProps = {
  full: boolean
  set: T.Tracker.SiteIconSet
  style?: Kb.Styles.StylesCrossPlatform
}

export const SiteIcon = (props: SiteIconProps) => {
  const style = props.full ? siteIconStyles.siteIconFull : siteIconStyles.siteIcon
  return Kb.Styles.isMobile ? (
    <Kb.Image2
      src={siteIconToNativeSrcSet(props.set)}
      style={Kb.Styles.collapseStyles([style, props.style])}
    />
  ) : (
    <Kb.Box
      style={Kb.Styles.collapseStyles([
        style,
        props.style,
        {backgroundImage: siteIconToSrcSet(props.set)},
      ] as any)}
    />
  )
}

const siteIconStyles = Kb.Styles.styleSheetCreate(() => ({
  siteIcon: Kb.Styles.platformStyles({
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
  siteIconFull: Kb.Styles.platformStyles({
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
