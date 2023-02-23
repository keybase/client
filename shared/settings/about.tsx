import * as Container from '../util/container'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Styles from '../styles'
import * as Kb from '../common-adapters'
import {version} from '../constants/platform'

const About = () => {
  const dispatch = Container.useDispatch()
  const onShowPrivacyPolicy = () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {title: 'Privacy Policy', url: 'https://keybase.io/_/webview/privacypolicy'},
            selected: 'webLinks',
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
            selected: 'webLinks',
          },
        ],
      })
    )

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
      <Kb.Icon type="icon-keybase-logo-64" />
      <Kb.Box2 direction="vertical" alignItems="center" style={styles.version}>
        <Kb.Text center={true} type="Body">
          You are running version{' '}
        </Kb.Text>
        <Kb.Text type="BodySemibold" selectable={true}>
          {version}
        </Kb.Text>
      </Kb.Box2>
      <Kb.Text style={styles.terms} type="BodyPrimaryLink" onClick={onShowTerms}>
        Terms and Conditions
      </Kb.Text>
      <Kb.Text type="BodyPrimaryLink" onClick={onShowPrivacyPolicy}>
        Privacy Policy
      </Kb.Text>
    </Kb.Box2>
  )
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
