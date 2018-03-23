// @flow
import * as React from 'react'
import {globalColors, globalMargins, globalStyles, isMobile, platformStyles} from '../../../../styles'
import {Box, ClickableBox, Icon, ProgressIndicator, Text} from '../../../../common-adapters'
import {type MenuItem} from '../../../../common-adapters/popup-menu'
import {type RetentionPolicy, type _RetentionPolicy} from '../../../../constants/types/teams'
import {daysToLabel} from '../../../../util/timestamp'

export type Props = {
  policy: RetentionPolicy,
  teamPolicy?: RetentionPolicy,
  onSelect: (policy: _RetentionPolicy, changed: boolean) => void,
  isTeamWide: boolean,
  onShowDropdown: (items: Array<MenuItem | 'Divider' | null>, target: ?Element) => void,
}

type State = {
  selected: _RetentionPolicy,
  items: Array<MenuItem | 'Divider' | null>,
  showMenu: boolean,
}

const commonOptions = [1, 7, 30, 90, 365]

class RetentionPicker extends React.Component<Props, State> {
  state = {
    selected: {type: 'retain', days: 0},
    items: [],
    showMenu: false,
  }

  _onSelect = (val: number | 'retain' | 'inherit') => {
    let selected: _RetentionPolicy
    if (typeof val === 'number') {
      selected = {type: 'expire', days: val}
    } else if (val === 'inherit') {
      selected = {type: 'inherit', days: 0}
    } else {
      selected = {type: 'retain', days: 0}
    }
    this.setState({selected})
    const changed = !(selected.type === this.props.policy.type && selected.days === this.props.policy.days)
    this.props.onSelect(selected, changed)
  }

  _makeItems = () => {
    const items = commonOptions.map(days => ({
      title: daysToLabel(days),
      onClick: () => this._onSelect(days),
    }))
    items.push({title: 'Keep forever', onClick: () => this._onSelect('retain')})
    if (!this.props.isTeamWide && this.props.teamPolicy) {
      // Add inherit option
      items.unshift({
        title: policyToInheritLabel(this.props.teamPolicy),
        onClick: () => this._onSelect('inherit'),
      })
    }
    this.setState({items})
  }

  _setInitialSelected = (policy?: RetentionPolicy) => {
    if (policy) {
      this.setState({selected: policy})
    } else if (this.props.policy) {
      this.setState({selected: this.props.policy})
    }
  }

  _label = () => {
    return policyToLabel(this.state.selected, this.props.teamPolicy)
  }

  componentDidMount() {
    this._makeItems()
    this._setInitialSelected()
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.policy !== this.props.policy || nextProps.teamPolicy !== this.props.teamPolicy) {
      this._makeItems()
      this._setInitialSelected(nextProps.policy)
    }
  }

  _onShowDropdown = (evt: SyntheticEvent<Element>) => {
    const target = isMobile ? null : evt.currentTarget
    this.props.onShowDropdown(this.state.items, target)
  }

  render() {
    return this.props.policy ? (
      <Box style={globalStyles.flexBoxColumn}>
        <Box style={headingStyle}>
          <Text type="BodySmallSemibold">Message deletion</Text>
          <Icon type="iconfont-timer" style={{fontSize: 16, marginLeft: globalMargins.xtiny}} />
        </Box>
        <ClickableBox
          onClick={this._onShowDropdown}
          style={dropdownStyle}
          underlayColor={globalColors.white_40}
        >
          <Box style={labelStyle}>
            <Text type="BodySemibold">{this._label()}</Text>
          </Box>
          <Icon type="iconfont-caret-down" inheritColor={true} style={{fontSize: 7}} />
        </ClickableBox>
        {this.props.isTeamWide && (
          <Text style={{marginTop: globalMargins.xtiny}} type="BodySmall">
            Individual channels can override this.
          </Text>
        )}
      </Box>
    ) : (
      <ProgressIndicator style={progressIndicatorStyle} />
    )
  }
}

const headingStyle = platformStyles({
  common: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    marginTop: globalMargins.small,
    marginBottom: globalMargins.tiny,
  },
})

const dropdownStyle = platformStyles({
  common: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    borderColor: globalColors.lightGrey2,
    borderRadius: 100,
    borderStyle: 'solid',
    borderWidth: 1,
    minWidth: 220,
    paddingRight: globalMargins.small,
  },
  isElectron: {
    width: 220,
  },
})

const labelStyle = platformStyles({
  common: {
    ...globalStyles.flexBoxCenter,
    minHeight: isMobile ? 40 : 32,
    width: '100%',
  },
})

const progressIndicatorStyle = platformStyles({
  common: {
    width: 30,
    height: 30,
    marginTop: globalMargins.small,
  },
})

// Utilities for transforming retention policies <-> labels
const policyToLabel = (p: _RetentionPolicy, parent: ?_RetentionPolicy) => {
  switch (p.type) {
    case 'retain':
      return 'Keep forever'
    case 'expire':
      return daysToLabel(p.days)
    case 'inherit':
      if (!parent) {
        throw new Error(`Got policy of type 'inherit' without an inheritable parent policy`)
      }
      return policyToInheritLabel(parent)
  }
  return ''
}
const policyToInheritLabel = (p: _RetentionPolicy) => {
  const label = policyToLabel(p)
  return `Use team default (${label})`
}

export default RetentionPicker
