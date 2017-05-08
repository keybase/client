// @flow

import React from 'react'
import {globalStyles, globalMargins} from '../styles'
import {Box, Icon, Text} from '../common-adapters'

import type {Props} from './about'

const About = ({version}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1, alignItems: 'center', justifyContent: 'center'}}>
    <Icon type='icon-keybase-logo-64' />
    <Text style={{textAlign: 'center', paddingTop: globalMargins.large, marginBottom: globalMargins.large}} type='Body'>You are running version <Text type='BodySemibold'>{version}</Text></Text>
    <Text style={{marginBottom: globalMargins.tiny}} type='BodyPrimaryLink' onClickURL='https://keybase.io/_/webview/terms'>Term and Conditions</Text>
    <Text type='BodyPrimaryLink' onClickURL='https://keybase.io/_/webview/privacypolicy'>Privacy Policy</Text>
  </Box>
)

export default About
