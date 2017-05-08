// @flow

import React from 'react'
import {globalStyles, globalMargins} from '../styles'
import {Box, Icon, Text, NativeWebView} from '../common-adapters/index.native'

import type {Props} from './about'

const About = ({version, onShowTerms, onShowPrivacyPolicy}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1, alignItems: 'center', justifyContent: 'center'}}>
    <Icon type='icon-keybase-logo-64' />
    <Text style={{textAlign: 'center', paddingTop: globalMargins.large, marginBottom: globalMargins.large}} type='Body'>You are running version <Text type='BodySemibold'>{version}</Text></Text>
    <Text style={{marginBottom: globalMargins.tiny}} type='BodyPrimaryLink' onClick={onShowTerms}>Terms and Conditions</Text>
    <Text type='BodyPrimaryLink' onClick={onShowPrivacyPolicy}>Privacy Policy</Text>
  </Box>
)

export default About
