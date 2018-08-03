// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {}

const Participants = (props: Props) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} gap="tiny" style={styles.container}>
    {/* <Kb.Box2 direction="horizontal"> */}
    <Kb.Text type="BodyTinySemibold" style={styles.headingText}>
      To:
    </Kb.Text>
    <Kb.Avatar size={32} />
    <Kb.Box2 direction="vertical">
      <Kb.ConnectedUsernames type="BodySmall" usernames={['russel']} />
      <Kb.Text type="BodyTiny">Russel Smith</Kb.Text>
    </Kb.Box2>
    {/* </Kb.Box2> */}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: 7.5,
    paddingBottom: 7.5,

    marginTop: Styles.globalMargins.tiny,
    alignItems: 'center',
  },
  headingText: {
    color: Styles.globalColors.blue,
  },
})

export default Participants
