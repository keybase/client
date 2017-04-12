// @flow

import React from 'react'
import {globalStyles, globalMargins} from '../styles'
import {Box, Icon, Text} from '../common-adapters'

import type {Props} from './about'

const About = ({version}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1, alignItems: 'center', justifyContent: 'center'}}>
    <Icon type='icon-keybase-logo-64' />
    <Text style={{textAlign: 'center', paddingTop: globalMargins.large}} type='Body'>You are running version <Text type='BodySemibold'>{version}</Text></Text>
  </Box>
)

export default About
