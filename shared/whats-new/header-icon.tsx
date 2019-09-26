import React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'

type Props = {
  newFeatures: boolean
}

const HeaderIcon = (props: Props) =>
  props.newFeatures ? (
    <Kb.Icon type="iconfont-radio" color={Styles.globalColors.black} />
  ) : (
    <Kb.Icon type="iconfont-radio" color={Styles.globalColors.black} />
  )
export default HeaderIcon
