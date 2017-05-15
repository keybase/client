// @flow
import React from 'react'
import Box from './box'
import Text from './text'
import {globalColors, globalMargins} from '../styles'
import HeaderHOC from './header-hoc'
import {isMobile} from '../constants/platform'
import {branch} from 'recompose'

export type Props = {
  error: string,
}

const ErrorLoadingProfile = ({error, onBack}: Props) => (
  <Box style={{width: 320, flex: 1}}>
    <Box style={{marginTop: globalMargins.xlarge, textAlign: 'center'}}>
      <Text type="BodyError" style={{textAlign: 'center', color: globalColors.black_40}}>
        Error loading profile: {error}
      </Text>
    </Box>
  </Box>
)

export default branch(props => isMobile && props.onBack, HeaderHOC)(ErrorLoadingProfile)
