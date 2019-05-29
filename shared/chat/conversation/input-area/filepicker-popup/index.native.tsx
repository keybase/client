import * as React from 'react'
import {FloatingMenu} from '../../../../common-adapters'
import {Box2, Text} from '../../../../common-adapters/mobile.native'
import {Props} from './index.types'
import {isIOS} from '../../../../constants/platform'

const Prompt = () => (
  <Box2 direction="horizontal" fullWidth={true} gap="xtiny" style={promptContainerStyle}>
    <Text type="BodySmallSemibold">Select attachment type</Text>
  </Box2>
)

const promptContainerStyle = {
  alignItems: 'center',
  justifyContent: 'center',
  paddingBottom: 24,
  paddingTop: 24,
}

class FilePickerPopup extends React.Component<Props> {
  render() {
    const items = isIOS
      ? [
          {
            onClick: () => {
              this.props.onSelect('mixed', 'camera')
            },
            title: 'Take Photo or Video',
          },
          {
            onClick: () => {
              this.props.onSelect('mixed', 'library')
            },
            title: 'Choose from Library',
          },
        ]
      : [
          {
            onClick: () => {
              this.props.onSelect('photo', 'camera')
            },
            title: 'Take Photo',
          },
          {
            onClick: () => {
              this.props.onSelect('video', 'camera')
            },
            title: 'Take Video',
          },
          {
            onClick: () => {
              this.props.onSelect('photo', 'library')
            },
            title: 'Photo from Library',
          },
          {
            onClick: () => {
              this.props.onSelect('video', 'library')
            },
            title: 'Video from Library',
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
