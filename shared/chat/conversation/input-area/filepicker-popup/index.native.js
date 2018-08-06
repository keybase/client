// @flow
import * as React from 'react'
import {FloatingMenu} from '../../../../common-adapters'
import {Box2, Text} from '../../../../common-adapters/mobile.native'
import type {Props} from './index.types'
import {isIOS} from '../../../../constants/platform'

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
  render() {
    // TODO: Have separate menu items for Take Photo, Take Video,
    // Photo from Library, and Video from Library on Android when
    // launchCamera and launchImageLibrary Android bugs are fixed.
    const items = isIOS
      ? [
          {
            onClick: () => {
              this.props.onSelect('photo', 'camera')
            },
            title: 'Take Photo',
          },
          {
            onClick: () => {
              this.props.onSelect('mixed', 'library')
            },
            title: 'Photo or Video from Library',
          },
        ]
      : [
          {
            onClick: () => {
              this.props.onSelect('photo', 'pick')
            },
            title: 'Photo',
          },
          {
            onClick: () => {
              this.props.onSelect('video', 'pick')
            },
            title: 'Video',
          },
        ]
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
