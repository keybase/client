import * as Container from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as React from 'react'
import * as Styles from '../styles'
import * as Kb from '../common-adapters/mobile.native'
import {version} from '../constants/platform'

const About = () => {
  const dispatch = Container.useDispatch()
  const onShowPrivacyPolicy = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {title: 'Privacy Policy', url: 'https://keybase.io/_/webview/privacypolicy'},
            selected: 'privacyPolicy',
          },
        ],
      })
    )
  const onShowTerms = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {title: 'Terms', url: 'https://keybase.io/_/webview/terms'},
            selected: 'terms',
          },
        ],
      })
    )

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
      <Kb.Icon type="icon-keybase-logo-64" />
      <Kb.Text center={true} style={styles.version} type="Body">
        You are running version <Kb.Text type="BodySemibold">{version}</Kb.Text>
      </Kb.Text>
      <Kb.Text style={styles.terms} type="BodyPrimaryLink" onClick={onShowTerms}>
        Terms and Conditions
      </Kb.Text>
      <Kb.Text type="BodyPrimaryLink" onClick={onShowPrivacyPolicy}>
        Privacy Policy
      </Kb.Text>
    </Kb.Box2>
  )
}
About.navigationOptions = {
  header: undefined,
  title: 'About',
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  terms: {
    marginBottom: Styles.globalMargins.tiny,
  },
  version: {
    marginBottom: Styles.globalMargins.large,
    paddingTop: Styles.globalMargins.large,
  },
}))

export default About
