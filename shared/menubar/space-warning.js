// @flow
import * as React from 'react'
import * as Kb from '../common-adapters'

export type BannerType = 'warning' | 'failure' | 'none'
type Props = {
  onClose: () => void,
  onRetry: () => void,
  bannerType: BannerType,
}

const Banner = (props: Props) =>
  props.bannerType !== 'none' && (
    <Kb.Banner
      onClose={props.onClose}
      text={
        props.bannerType === 'warning'
          ? 'You have less than 1 GB of' + ' storage space. Make some space, or unsync some folders.'
          : 'You are' + ' out of storage space. Unsync some folders, or make some space then'
      }
      color={props.bannerType === 'warning' ? 'blue' : 'red'}
      actions={[...(props.onRetry ? [{onClick: props.onRetry, title: 'retry' + ' the sync.'}] : [])]}
    />
  )

export default Banner
