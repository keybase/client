import * as React from 'react'
// import * as Kb from '../../../../../common-adapters'
// import * as Styles from '../../../../../styles'
// import * as Chat2Gen from '../../../../../actions/chat2-gen'
// import * as FsGen from '../../../../../actions/fs-gen'
// import * as Container from '../../../../../util/container'
// import {GetIdsContext} from '../../ids-context'
import VideoImpl from './videoimpl'

type Props = {
  toggleMessageMenu: () => void
  isHighlighted?: boolean
}

const Video = React.memo(function Video(_p: Props) {
  return <VideoImpl />
})

export default Video
