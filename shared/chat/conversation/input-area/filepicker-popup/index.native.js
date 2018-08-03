// @flow
import * as React from 'react'
import {FloatingMenu} from '../../../../common-adapters'
import {Box2, Text} from '../../../../common-adapters/mobile.native'
import type {Props} from './index.types'

const Prompt = () => (
  <Box2 direction="horizontal" fullWidth={true} gap="xtiny" style={promptContainerStyle}>
    <Text type="BodySmallSemibold">Select Attachment Type</Text>
  </Box2>
)

const promptContainerStyle = {
  alignItems: 'center',
  justifyContent: 'center',
}

class FilePickerPopup extends React.Component<Props> {
  onImage = () => {
    this.props.onSelect('photo')
  }

  onVideo = () => {
    this.props.onSelect('video')
  }

  render() {
    const items = [...[{onClick: this.onImage, title: 'Photo'}], ...[{onClick: this.onVideo, title: 'Video'}]]
    const header = {
      title: 'header',
      view: <Prompt />,
    }
    return (
      <FloatingMenu
        header={header}
        attachTo={this.props.attachTo}
        items={items}
        onHidden={this.props.onHidden}
        visible={this.props.visible}
        closeOnSelect={true}
      />
    )
  }
}

export default FilePickerPopup
