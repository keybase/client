import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import {openURL as openUrl} from '@/util/misc'

const privacyPolicy = 'https://keybase.io/_/webview/privacypolicy'
const terms = 'https://keybase.io/_/webview/terms'

const About = () => {
  const navigateAppend = C.Router2.navigateAppend
  const onShowPrivacyPolicy = () => {
    if (C.isMobile) {
      navigateAppend({
        name: 'webLinks',
        params: {title: 'Privacy Policy', url: privacyPolicy},
      })
    } else {
      openUrl(privacyPolicy)
    }
  }
  const onShowTerms = () => {
    if (C.isMobile) {
      navigateAppend({name: 'webLinks', params: {title: 'Terms', url: terms}})
    } else {
      openUrl(terms)
    }
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} justifyContent="center" style={styles.container}>
      <Kb.ImageIcon type="icon-keybase-logo-64" />
      <Kb.Box2 direction="vertical" alignItems="center" style={styles.version}>
        <Kb.Text center={true} type="Body">
          You are running version{' '}
        </Kb.Text>
        <Kb.Text type="BodySemibold" selectable={true}>
          {C.version}
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
const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    alignItems: 'center',
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
