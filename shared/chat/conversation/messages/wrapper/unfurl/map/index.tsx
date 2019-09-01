import * as React from 'react'
import * as Types from '../../../../../../constants/types/chat2'
import * as Kb from '../../../../../../common-adapters/index'
import UnfurlImage from '../image'

type Props = {
  coord: Types.Coordinate
  imageHeight: number
  imageWidth: number
  imageURL: string
  isLiveLocation: boolean
  isLiveLocationDone: boolean
  time: number
  url: string
}

const UnfurlMap = (props: Props) => {
  return (
    <Kb.Box2 direction="horizontal">
      <UnfurlImage
        url={props.imageURL}
        height={props.imageHeight}
        width={props.imageWidth}
        isVideo={false}
        autoplayVideo={false}
      />
    </Kb.Box2>
  )
}

export default UnfurlMap
