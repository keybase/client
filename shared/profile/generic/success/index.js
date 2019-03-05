// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {|
  serviceIcon: React.Node,
  iconBadge: React.Node,
  proofUsername: string,
  onClose: () => void,
|}

const Success = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
    <Kb.Box2
      direction="vertical"
      centerChildren={true}
      alignItems={'center'}
      fullWidth={true}
      style={styles.topContainer}
    >
      <Kb.Box2 direction="vertical" style={styles.serviceIconContainer}>
        {props.serviceIcon}
        <Kb.Box2 direction="vertical" style={styles.iconBadgeContainer}>
          {props.iconBadge}
        </Kb.Box2>
      </Kb.Box2>
      <>
        <Kb.Text type="Body">You are provenly</Kb.Text>
        <Kb.Text type="BodySemibold">{props.proofUsername}</Kb.Text>
      </>
    </Kb.Box2>
    <Kb.Box2 direction="horizontal" centerChildren={true} fullWidth={true} style={styles.bottomContainer}>
      <Kb.Button type="Secondary" label="Close and reload Profile" onClick={props.onClose} />
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  bottomContainer: {
    height: 80,
  },
  iconBadgeContainer: {
    bottom: -5,
    position: 'absolute',
    right: -5,
  },
  serviceIconContainer: Styles.platformStyles({
    common: {
      marginBottom: Styles.globalMargins.tiny,
      position: 'relative',
    },
  }),
  topContainer: Styles.platformStyles({
    common: {
      flex: 1,
    },
  }),
})

export default Success
