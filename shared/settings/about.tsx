import * as React from 'react'
import {globalStyles, globalMargins} from '../styles'
import * as Kb from '../common-adapters/mobile.native'

type Props = {
  onShowPrivacyPolicy: () => void
  onShowTerms: () => void
  version: string
}

const About = ({version, onShowTerms, onShowPrivacyPolicy}: Props) => (
  <Kb.Box
    style={{...globalStyles.flexBoxColumn, alignItems: 'center', flexGrow: 1, justifyContent: 'center'}}
  >
    <Kb.Icon type="icon-keybase-logo-64" />
    <Kb.Text
      center={true}
      style={{marginBottom: globalMargins.large, paddingTop: globalMargins.large}}
      type="Body"
    >
      You are running version <Kb.Text type="BodySemibold">{version}</Kb.Text>
    </Kb.Text>
    <Kb.Text style={{marginBottom: globalMargins.tiny}} type="BodyPrimaryLink" onClick={onShowTerms}>
      Terms and Conditions
    </Kb.Text>
    <Kb.Text type="BodyPrimaryLink" onClick={onShowPrivacyPolicy}>
      Privacy Policy
    </Kb.Text>
  </Kb.Box>
)

export default About
