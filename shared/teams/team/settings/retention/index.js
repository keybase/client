// @flow
import * as React from 'react'
import {globalColors, globalMargins, globalStyles, isMobile, platformStyles} from '../../../../styles'
import {Box, ClickableBox, Icon, ProgressIndicator, Text} from '../../../../common-adapters'
import {type MenuItem} from '../../../../common-adapters/popup-menu'
import {type _RetentionPolicy} from '../../../../constants/types/teams'

export type Props = {
  policy: _RetentionPolicy,
  teamPolicy?: _RetentionPolicy,
  onSelect: (policy: _RetentionPolicy, changed: boolean, lowered: boolean) => void,
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
    const decreased =
      policyToComparable(selected, this.props.teamPolicy) <
      policyToComparable(this.props.policy, this.props.teamPolicy)
    this.props.onSelect(selected, changed, decreased)
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

  _setInitialSelected = (policy?: _RetentionPolicy) => {
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
    if (
      !policyEquals(nextProps.policy, this.props.policy) ||
      !policyEquals(nextProps.teamPolicy, this.props.teamPolicy)
    ) {
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
const daysToLabel = (days: number) => {
  let label = `${days} day`
  if (days !== 1) {
    label += 's'
  }
  return label
}
// Use only for comparing policy durations
const policyToComparable = (p: _RetentionPolicy, parent: ?_RetentionPolicy): number => {
  let res: number = -1
  switch (p.type) {
    case 'retain':
      res = Infinity
      break
    case 'inherit':
      if (!parent) {
        throw new Error(`Got policy of type 'inherit' without an inheritable parent policy`)
      }
      res = policyToComparable(parent)
      break
    case 'expire':
      res = p.days
      break
  }
  if (res === -1) {
    // no good
    throw new Error('Impossible case encountered: res = -1 in retention policyToComparable')
  }
  return res
}
const policyEquals = (p1?: _RetentionPolicy, p2?: _RetentionPolicy): boolean => {
  if (p1 && p2) {
    return p1.type === p2.type && p1.days === p2.days
  }
  return p1 === p2
}

export {daysToLabel}
export default RetentionPicker
