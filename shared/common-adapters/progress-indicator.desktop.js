// @flow
import Icon from './icon'
import * as React from 'react'

type Props = {
  style?: Object,
  white?: boolean,
  type?: 'Small' | 'Large',
}

const ProgressIndicator = ({white, style}: Props) => (
  <Icon style={style} type={white ? 'icon-progress-white-animated' : 'icon-progress-grey-animated'} />
)

export default ProgressIndicator
