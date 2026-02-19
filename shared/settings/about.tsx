import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import openUrl from '@/util/open-url'

const privacyPolicy = 'https://keybase.io/_/webview/privacypolicy'
const terms = 'https://keybase.io/_/webview/terms'

const About = () => {
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onShowPrivacyPolicy = () => {
    if (C.isMobile) {
      navigateAppend({
        props: {title: 'Privacy Policy', url: privacyPolicy},
        selected: 'webLinks',
      })
    } else {
      openUrl(privacyPolicy)
    }
  }
  const onShowTerms = () => {
    if (C.isMobile) {
      navigateAppend({props: {title: 'Terms', url: terms}, selected: 'webLinks'})
    } else {
      openUrl(terms)
    }
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
      <Kb.Icon type="icon-keybase-logo-64" />
      <Kb.Box2 direction="vertical" alignItems="center" style={styles.version}>
        <Kb.Text3 center={true} type="Body">
          You are running version{' '}
        </Kb.Text3>
        <Kb.Text3 type="BodySemibold" selectable={true}>
          {C.version}
        </Kb.Text3>
      </Kb.Box2>
      <Kb.Text3 style={styles.terms} type="BodyPrimaryLink" onClick={onShowTerms}>
        Terms and Conditions
      </Kb.Text3>
      <Kb.Text3 type="BodyPrimaryLink" onClick={onShowPrivacyPolicy}>
        Privacy Policy
      </Kb.Text3>
    </Kb.Box2>
  )
}
const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  terms: {
    marginBottom: Kb.Styles.globalMargins.tiny,
  },
  version: {
    marginBottom: Kb.Styles.globalMargins.large,
    paddingTop: Kb.Styles.globalMargins.large,
  },
}))

export default About
