import React from 'react'
import type {Props} from './render'
import {Box/* , Text, Icon */} from '../common-adapters'
import {globalStyles, globalColors} from '../styles/style-guide'
import {resolveImageAsURL} from '../../desktop/resolve-root'

const Row = ({users, icon, isPublic, ignored, isFirst}) => (
  console.log(users, icon, isPublic, ignored, isFirst),
  <Box style={{...rowContainer,
    ...(isPublic ? rowContainerPublic : rowContainerPrivate),
    ...(isFirst ? {borderBottom: undefined} : {})}}>
    <Box style={{...stylesAvatarContainer, ...(isPublic ? stylesAvatarContainerPublic : stylesAvatarContainerPrivate)}} />
    <Box style={stylesBodyContainer} />
    <Box style={stylesActionContainer} />
  </Box>
)

const Render = ({tlfs, ignored, isPublic}: Props) => {
  console.log('aaa', tlfs)
  return (
  <div>
    {tlfs.map((t, idx) => <Row users={[t.name]} icon='' isPublic={isPublic} ignored={false} isFirst={console.log(idx), !idx} />)}
    {ignored.map((i, idx) => <Row users={[i.name]} icon='' isPublic={isPublic} ignored isFirst={!idx} />)}
  </div>
  )
}

const rowContainer = {
  ...globalStyles.flexBoxRow,
  minHeight: 48,
  borderBottom: `solid 1px ${globalColors.black_10}`
}

const rowContainerPublic = {
  backgroundColor: globalColors.white,
  color: globalColors.yellowGreen2
}

const rowContainerPrivate = {
  backgroundColor: globalColors.darkBlue,
  color: globalColors.white
}

const stylesAvatarContainer = {
  width: 48,
  minHeight: 48,
  padding: 8
}

const stylesAvatarContainerPublic = {}

const stylesAvatarContainerPrivate = {
  backgroundColor: globalColors.darkBlue3,
  backgroundImage: `url(${resolveImageAsURL('icons', 'damier-pattern-good-open.png')})`,
  backgroundRepeat: 'repeat'
}

const stylesBodyContainer = {
  flex: 1
}

const stylesActionContainer = {
  width: 96,
  height: 48,
  marginLeft: 16,
  marginRight: 16
}

export default Render

