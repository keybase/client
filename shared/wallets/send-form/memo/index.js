// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {}

const Memo = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.memoContainer}>
      <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
        Encrypted note
      </Kb.Text>
      <Kb.Text type="BodySmall" style={styles.bodyText}>
        Encrypted memo
      </Kb.Text>
    </Kb.Box2>
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.memoContainer}>
      <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
        Public memo
      </Kb.Text>
      <Kb.Text type="BodySmall" style={styles.bodyText}>
        Public note
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  // container: Styles.platformStyles({
  //   isElectron: {
  //     borderBottomStyle: 'solid',
  //     borderBottomWidth: 1,
  //     borderBottomColor: Styles.globalColors.black_05,
  //   },
  // }),
  memoContainer: Styles.platformStyles({
    isElectron: {
      paddingTop: 7.5,
      paddingBottom: 7.5,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,

      borderTopStyle: 'solid',
      borderTopWidth: 1,
      borderTopColor: Styles.globalColors.black_05,
    },
  }),
  headingText: {
    color: Styles.globalColors.blue,
    marginBottom: Styles.globalMargins.xtiny,
  },
  bodyText: {},
})

export default Memo
