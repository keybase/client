import * as React from 'react'
import * as Kb from '../../../../common-adapters/mobile.native'
import {Props} from './index.types'
import {isIOS} from '../../../../constants/platform'

const Prompt = () => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    gap="xtiny"
    // @ts-ignore TODO fix styles
    style={promptContainerStyle}
  >
    <Kb.Text type="BodySmallSemibold">Select attachment type</Kb.Text>
  </Kb.Box2>
)

const promptContainerStyle = {
  alignItems: 'center',
  justifyContent: 'center',
  paddingBottom: 24,
  paddingTop: 24,
}

class FilePickerPopup extends React.Component<Props> {
  render() {
    const iosItems = [
      {onClick: () => this.props.onSelect('mixed', 'camera'), title: 'Take Photo or Video'},
      {onClick: () => this.props.onSelect('mixed', 'library'), title: 'Choose from Library'},
    ]

    const androidItems = [
      {onClick: () => this.props.onSelect('photo', 'camera'), title: 'Take Photo'},
      {onClick: () => this.props.onSelect('video', 'camera'), title: 'Take video'},
      {onClick: () => this.props.onSelect('photo', 'library'), title: 'Photo from Library'},
      {onClick: () => this.props.onSelect('video', 'library'), title: 'Video from Library'},
    ]
    const items = isIOS ? iosItems : androidItems

    const header = {
      title: 'header',
      view: <Prompt />,
    }

    return (
      <Kb.FloatingMenu
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
