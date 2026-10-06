import * as Styles from '@/styles'
import type * as React from 'react'
import {Box2} from '@/common-adapters/box'

// The one modal footer: a divider over it on desktop (none on phone, where the sheet runs to the
// bottom edge) and the bottom corners of the desktop box.
const ModalFooter = (props: {children: React.ReactNode; style?: Styles.StylesCrossPlatform}) => {
  const {children, style} = props
  const styles = useStyles()
  return (
    <Box2
      direction="vertical"
      centerChildren={true}
      fullWidth={true}
      noShrink={true}
      style={Styles.collapseStyles([styles.footer, style])}
    >
      {children}
    </Box2>
  )
}

const useStyles = Styles.createStyleHook(theme => ({
  footer: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.small),
      minHeight: 56,
    },
    isElectron: {
      ...Styles.topDivider(theme),
      ...Styles.roundedBottom(),
    },
  }),
}))

export default ModalFooter
