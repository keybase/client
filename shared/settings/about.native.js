// @flow

import * as React from 'react'
import {globalStyles, globalMargins} from '../styles'
import {Box, Icon, Text} from '../common-adapters/mobile.native'

import type {Props} from './about'

const About = ({version, onShowTerms, onShowPrivacyPolicy}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flexGrow: 1, justifyContent: 'center'}}>
    <Icon type="icon-keybase-logo-64" />
    <Text
      style={{marginBottom: globalMargins.large, paddingTop: globalMargins.large, textAlign: 'center'}}
      type="Body"
    >
      You are running version <Text type="BodySemibold">{version}</Text>
    </Text>
    <Text style={{marginBottom: globalMargins.tiny}} type="BodyPrimaryLink" onClick={onShowTerms}>
      Terms and Conditions
    </Text>
    <Text type="BodyPrimaryLink" onClick={onShowPrivacyPolicy}>
      Privacy Policy
    </Text>
  </Box>
)

export default About
