import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import * as Tracker2Types from '../../../constants/types/tracker2'
import {SiteIcon} from '../shared'

type Props = {
  errorText: string
  onClose: () => void
  proofUsername: string
  serviceIcon: Tracker2Types.SiteIconSet
}

const _Result = (props: Props) => {
  const success = !props.errorText
  const iconType = success ? 'icon-proof-success' : 'icon-proof-broken'
  let frag = (
    <>
      <Kb.Text type="Body">You are provably</Kb.Text>
      <Kb.Text type="BodySemibold">{props.proofUsername}</Kb.Text>
    </>
  )
  if (!success) {
    frag = (
      <>
        <Kb.Text type="Body">{props.errorText}</Kb.Text>
      </>
    )
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
      <Kb.Box2
        direction="vertical"
        centerChildren={true}
        alignItems={'center'}
        fullWidth={true}
        style={styles.topContainer}
      >
        <Kb.Box2 direction="vertical" style={styles.serviceIconContainer}>
          <SiteIcon set={props.serviceIcon} full={true} />
          <Kb.Box2 direction="vertical" style={styles.iconBadgeContainer}>
            <Kb.Icon type={iconType} color={Styles.globalColors.green} />
          </Kb.Box2>
        </Kb.Box2>
        {frag}
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" centerChildren={true} fullWidth={true} style={styles.bottomContainer}>
        <Kb.Button type="Dim" label="Close and reload Profile" onClick={props.onClose} />
      </Kb.Box2>
    </Kb.Box2>
  )
}
const Result = Kb.HeaderOrPopup(_Result)

const styles = Styles.styleSheetCreate({
  bottomContainer: {
    height: 80,
  },
  container: Styles.platformStyles({
    isElectron: {
      height: 485,
      width: 560,
    },
  }),
  iconBadgeContainer: {
    bottom: -5,
    position: 'absolute',
    right: -5,
  },
  serviceIcon: {
    height: 64,
    width: 64,
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

export default Result
