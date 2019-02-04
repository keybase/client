// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import {Box} from '../../common-adapters'
import ConnectedFilesBanner from './fileui-banner/container'
import ConnectedResetBanner from './reset-banner/container'

const Banner = ({path, shouldShowReset}: {path: Types.Path, shouldShowReset: boolean}) => (
  <Box>{shouldShowReset ? <ConnectedResetBanner path={path} /> : <ConnectedFilesBanner path={path} />}</Box>
)

export default Banner
