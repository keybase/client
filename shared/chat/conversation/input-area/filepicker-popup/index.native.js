// @flow
import * as React from 'react'
import {Box2, Text, FloatingPicker} from '../../../../common-adapters/mobile.native'
import type {Props} from './index.types'

const Prompt = () => (
  <Box2 direction="horizontal" fullWidth={true} gap="xtiny" style={promptContainerStyle}>
    <Text type="BodySmallSemibold">Select type of attachment:</Text>
  </Box2>
)

const promptContainerStyle = {
  alignItems: 'center',
  justifyContent: 'center',
}

type State = {selected: string}
class FilePickerPopup extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {selected: props.selected || 'photo'}
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.selected !== prevProps.selected) {
      this.setState({selected: this.props.selected || 'photo'})
    }
  }

  setSelected = (value: number | string) => {
    if (typeof value === 'number') {
      return
    }
    this.setState({selected: value})
  }

  onDone = () => {
    this.props.onSelect(this.state.selected)
    this.props.onHidden()
  }

  render() {
    const items = [{label: 'Send an image', value: 'photo'}, {label: 'Send a video', value: 'video'}]
    return (
      <FloatingPicker
        items={items}
        onSelect={this.setSelected}
        onHidden={this.props.onHidden}
        onCancel={this.props.onHidden}
        onDone={this.onDone}
        prompt={<Prompt />}
        promptString="Pick a timeout"
        visible={this.props.visible}
        selectedValue={this.state.selected}
      />
    )
  }
}

export default FilePickerPopup
