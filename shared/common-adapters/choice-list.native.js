// @flow
import React, {Component} from 'react'
import type {Props} from './choice-list'
import {Box, Text, Icon, NativeTouchableHighlight} from './index.native'
import {globalStyles, globalColors, globalMargins} from '../styles/style-guide'

type State = {
  activeIndex: ?number,
}

class ChoiceList extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {
      activeIndex: null,
    }
  }

  componentWillReceiveProps (nextProps: Props) {
    if (nextProps !== this.props) {
      this.setState({
        activeIndex: null,
      })
    }
  }

  render () {
    const {options} = this.props
    return (
      <Box>
        {options.map((op, idx) => (
          <NativeTouchableHighlight
            key={idx}
            underlayColor={globalColors.blue4}
            onPress={op.onClick}
            onPressIn={() => this.setState({activeIndex: idx})}
            onPressOut={() => this.setState({activeIndex: null})}>
            <Box style={styleEntry}>
              <Box style={styleIconContainer(this.state.activeIndex === idx)}>
              {typeof op.icon === 'string'
                ? <Icon style={styleIcon} type={op.icon} />
                : <Box style={styleIcon}>{op.icon}</Box>}
              </Box>
              <Box style={styleInfoContainer}>
                <Text style={styleInfoTitle} type='Body'>{op.title}</Text>
                <Text style={styleInfoDescription} type='BodySmall'>{op.description}</Text>
              </Box>
            </Box>
          </NativeTouchableHighlight>
        ))}
      </Box>
    )
  }
}

const styleEntry = {
  ...globalStyles.flexBoxRow,
  ...globalStyles.clickable,
  paddingTop: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
}

const styleIconContainer = (active) => ({
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'center',
  width: globalMargins.large + globalMargins.medium,
  height: globalMargins.large + globalMargins.medium,
  ...(active ? {} : {backgroundColor: globalColors.lightGrey}),
  borderRadius: (globalMargins.large + globalMargins.medium) / 2,
})

const styleIcon = {
  width: globalMargins.large,
  height: globalMargins.large,
}

const styleInfoContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  marginLeft: globalMargins.small,
}

const styleInfoTitle = {
  color: globalColors.blue,
}

const styleInfoDescription = {
  color: globalColors.black_40,
}

export default ChoiceList
