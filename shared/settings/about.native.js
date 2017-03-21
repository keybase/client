// @flow

import React from 'react'
import {globalStyles} from '../styles'
import {Box, Icon, Text} from '../common-adapters'

type Props = {}

const About = ({version}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, flex: 1, alignItems: 'center', justifyContent: 'center'}}>
    <Icon type='icon-keybase-logo-128' />
    <Text style={{textAlign: 'center'}} type='Body'>You are running <Text type='BodySemibold'>Version {version}</Text></Text>
  </Box>
)

export default About
