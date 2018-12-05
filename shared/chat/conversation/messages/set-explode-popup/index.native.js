// @flow
import * as React from 'react'
import {Box2, Icon, Text, FloatingPicker} from '../../../../common-adapters/mobile.native'
import {globalColors, globalMargins, styleSheetCreate} from '../../../../styles'
import type {Props} from './index.types'

const Announcement = () => (
  <Box2 direction="vertical" fullWidth={true} style={styles.announcementContainer}>
    <Icon
      type="iconfont-boom"
      color={globalColors.white}
      fontSize={64}
      style={{marginBottom: -10, marginTop: -10}}
    />
    <Text type="BodySmallSemibold" backgroundMode="Announcements" style={styles.headline}>
      Set a timeout on your messages and watch them
    </Text>
    <Text type="BodySmallSemibold" backgroundMode="Announcements" style={styles.headline}>
      E&nbsp;&nbsp;&nbsp;X&nbsp;&nbsp;&nbsp;P&nbsp;&nbsp;&nbsp;L&nbsp;&nbsp;&nbsp;O&nbsp;&nbsp;&nbsp;D&nbsp;&nbsp;&nbsp;E.
    </Text>
    <Text
      type="BodySmallSemiboldPrimaryLink"
      backgroundMode="Announcements"
      className="underline"
      onClickURL="https://keybase.io/blog/keybase-exploding-messages"
    >
      Learn more
    </Text>
  </Box2>
)

const styles = styleSheetCreate({
  announcementContainer: {
    alignItems: 'center',
    backgroundColor: globalColors.blue,
    padding: globalMargins.small,
    paddingBottom: globalMargins.small,
  },
  headline: {
    flexGrow: 1,
    paddingLeft: globalMargins.medium,
    paddingRight: globalMargins.medium,
    textAlign: 'center',
  },
})

const Prompt = () => (
  <Box2 direction="horizontal" fullWidth={true} gap="xtiny" style={promptContainerStyle}>
    <Text type="BodySmallSemibold">Explode messages after:</Text>
  </Box2>
)

const promptContainerStyle = {
  alignItems: 'center',
  justifyContent: 'center',
}

type State = {selected: number}
class SetExplodePopup extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {selected: props.selected || 0}
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.selected !== prevProps.selected) {
      this.setState({selected: this.props.selected || 0})
    }
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
        promptString="Pick a timeout"
        visible={this.props.visible}
        selectedValue={this.state.selected}
      />
    )
  }
}

export default SetExplodePopup
