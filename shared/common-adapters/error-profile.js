// @flow
import * as React from 'react'
import Box from './box'
import Text from './text'
import {globalColors, globalMargins, isMobile} from '../styles'
import HeaderHOC from './header-hoc'
import {branch} from 'recompose'

export type Props = {
  error: string,
}

const ErrorLoadingProfile = ({error, onBack}: Props) => (
  <Box style={{width: 320, flex: 1}}>
    <Box style={{marginTop: globalMargins.xlarge}}>
      <Text type="BodyError" style={{textAlign: 'center', color: globalColors.black_40}}>
        Error loading profile: {error}
      </Text>
    </Box>
  </Box>
)

export default branch(props => isMobile && !!props.onBack, HeaderHOC)(ErrorLoadingProfile)
