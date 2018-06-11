// @flow
import * as React from 'react'
import {Box2, Icon, Text, FloatingPicker} from '../../../../common-adapters/mobile.native'
import {globalColors, globalMargins} from '../../../../styles'
import type {Props} from './index.types'

const Announcement = () => (
  <Box2 direction="vertical" fullWidth={true} style={announcementContainerStyle}>
    <Icon
      type="iconfont-boom"
      color={globalColors.white}
      fontSize={48}
      style={{marginTop: -10, marginBottom: -10}}
    />
    <Text
      type="BodySemibold"
      backgroundMode="Announcements"
      style={{
        paddingLeft: globalMargins.medium,
        paddingRight: globalMargins.medium,
        flexGrow: 1,
        textAlign: 'center',
      }}
    >
      Set a timeout on your messages and watch them E X P L O D E
    </Text>
  </Box2>
)

const announcementContainerStyle = {
  alignItems: 'center',
  backgroundColor: globalColors.blue,
  padding: globalMargins.small,
  paddingBottom: globalMargins.small,
}

const Prompt = () => (
  <Box2 direction="horizontal" fullWidth={true} gap="xtiny" style={promptContainerStyle}>
    <Icon type="iconfont-bomb" fontSize={20} />
    <Text type="BodySmallSemibold">Explode messages after:</Text>
  </Box2>
)

const promptContainerStyle = {
  alignItems: 'center',
  justifyContent: 'center',
}

type State = {selected: number}
class SetExplodePopup extends React.Component<Props, State> {
  state = {selected: 0}

  static getDerivedStateFromProps(nextProps: Props, prevState: State) {
    return {selected: nextProps.selected || 0}
  }

  setSelected = (value: number | string) => {
    if (typeof value === 'string') {
      // never happens. makes flow happy.
      return
    }
    this.setState({selected: value})
  }

  onDone = () => {
    this.props.onSelect(this.state.selected)
    this.props.onHidden()
  }

  render() {
    const items = this.props.items.map(item => ({label: item.text, value: item.seconds}))
    return (
      <FloatingPicker
        header={this.props.isNew ? <Announcement /> : null}
        items={items}
        onSelect={this.setSelected}
        onHidden={this.props.onHidden}
        onCancel={this.props.onHidden}
        onDone={this.onDone}
        prompt={<Prompt />}
        promptString="Explode message after"
        visible={this.props.visible}
        selectedValue={this.state.selected}
      />
    )
  }
}

export default SetExplodePopup
