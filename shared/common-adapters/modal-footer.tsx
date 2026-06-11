import * as Styles from '@/styles'
import type * as React from 'react'
import {Box2} from '@/common-adapters/box'

const ModalFooter = (props: {
  children: React.ReactNode
  hideBorder?: boolean
  style?: Styles.StylesCrossPlatform
}) => (
  <Box2
    direction="vertical"
    centerChildren={true}
    fullWidth={true}
    style={Styles.collapseStyles([props.hideBorder ? styles.footerNoBorder : styles.footer, props.style])}
  >
    {props.children}
  </Box2>
)

const styles = Styles.styleSheetCreate(() => ({
  footer: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.small),
      ...Styles.topDivider(),
    },
    isElectron: {
      ...Styles.roundedBottom(),
    },
  }),
  footerNoBorder: Styles.platformStyles({
    common: {
      ...Styles.padding(Styles.globalMargins.xsmall, Styles.globalMargins.small),
      minHeight: 56,
    },
    isElectron: {
      ...Styles.roundedBottom(),
    },
  }),
}))

export default ModalFooter
