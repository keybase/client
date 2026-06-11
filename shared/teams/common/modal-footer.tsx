import * as Kb from '@/common-adapters'
import type * as React from 'react'

const ModalFooter = (props: {children: React.ReactNode; style?: Kb.Styles.StylesCrossPlatform}) => (
  <Kb.Box2
    direction="vertical"
    centerChildren={true}
    fullWidth={true}
    style={Kb.Styles.collapseStyles([styles.modalFooter, props.style])}
  >
    {props.children}
  </Kb.Box2>
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  modalFooter: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.padding(Kb.Styles.globalMargins.xsmall, Kb.Styles.globalMargins.small),
      ...Kb.Styles.topDivider(),
    },
    isElectron: {
      ...Kb.Styles.roundedBottom(),
    },
  }),
}))

export default ModalFooter
