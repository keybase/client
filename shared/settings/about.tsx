import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {openURL as openUrl} from '@/util/misc'

const privacyPolicy = 'https://keybase.io/_/webview/privacypolicy'
const terms = 'https://keybase.io/_/webview/terms'

const About = () => {
  const navigateAppend = C.Router2.navigateAppend
  const onShowPrivacyPolicy = () => {
    if (isMobile) {
      navigateAppend({
        name: 'webLinks',
        params: {title: 'Privacy Policy', url: privacyPolicy},
      })
    } else {
      void openUrl(privacyPolicy)
    }
  }
  const onShowTerms = () => {
    if (isMobile) {
      navigateAppend({name: 'webLinks', params: {title: 'Terms', url: terms}})
    } else {
      void openUrl(terms)
    }
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true} testID={TestIDs.SETTINGS_ABOUT}>
      <Kb.ImageIcon type="icon-keybase-logo-64" />
      <Kb.Text center={true} type="Body" style={styles.version}>
        You are running version{' '}
      </Kb.Text>
      <Kb.Text type="BodySemibold" selectable={true} style={styles.versionNumber}>
        {C.version}
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
const styles = Kb.Styles.styleSheetCreate(() => ({
  terms: {
    marginBottom: Kb.Styles.globalMargins.tiny,
  },
  version: {
    paddingTop: Kb.Styles.globalMargins.large,
  },
  versionNumber: {
    marginBottom: Kb.Styles.globalMargins.large,
  },
}))

export default About
