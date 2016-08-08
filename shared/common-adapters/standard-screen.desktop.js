// @flow
import React from 'react'
import {Box, Text, Icon} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'
import type {Props} from './standard-screen'

const StandardScreen = ({children, onClose, errorMessage}: Props) => {
  return (
    <Box style={styleContainer}>
      {!!onClose && <Icon style={styleClose} type='iconfont-close' onClick={onClose} />}
      {errorMessage && <Box style={styleErrorBanner}><Text style={styleErrorBannerText} type='BodySmallSemibold'>{errorMessage}</Text></Box>}
      <Box style={styleContentContainer}>
        {children}
      </Box>
    </Box>
  )
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.scrollable,
  flex: 1,
  alignItems: 'center',
  position: 'relative',
  paddingTop: globalMargins.large,
  paddingBottom: globalMargins.large,
}

const styleClose = {
  ...globalStyles.clickable,
  position: 'absolute',
  top: globalMargins.small,
  right: globalMargins.small,
  color: globalColors.black_10,
}

const styleErrorBanner = {
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
  alignItems: 'center',
  width: '100%',
  zIndex: 1,
  height: globalMargins.large,
  marginTop: -globalMargins.large,
  backgroundColor: globalColors.red,
}

const styleErrorBannerText = {
  color: globalColors.white,
}

const styleContentContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  margin: globalMargins.large,
  maxWidth: 512,
  textAlign: 'center',
}

export default StandardScreen
