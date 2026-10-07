import * as Styles from '@/styles'
import type * as React from 'react'
import {Box2} from '@/common-adapters/box'

type Props = {
  children: React.ReactNode
  // false over a colored body, which already sets the footer apart
  divider?: boolean
  style?: Styles.StylesCrossPlatform
}

// The one modal footer: a divider over it on desktop (none on phone, where the sheet runs to the
// bottom edge) and the bottom corners of the desktop box.
const ModalFooter = (props: Props) => {
  const {children, divider = true, style} = props
  const styles = useStyles()
  return (
    <Box2
      direction="vertical"
      centerChildren={true}
      fullWidth={true}
      noShrink={true}
      style={Styles.collapseStyles([styles.footer, divider && styles.divider, style])}
    >
      {children}
    </Box2>
  )
}

const useStyles = Styles.createStyleHook(theme => ({
  divider: Styles.platformStyles({isElectron: Styles.topDivider(theme)}),
  footer: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.small),
      minHeight: 56,
    },
    isElectron: Styles.roundedBottom(),
  }),
}))

export default ModalFooter
