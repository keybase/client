// @flow
import * as React from 'react'
import {
  globalColors,
  globalMargins,
  globalStyles,
  isMobile,
  platformStyles,
  collapseStyles,
  type StylesCrossPlatform,
} from '../../../../styles'
import {Box, ClickableBox, Icon, ProgressIndicator, Text} from '../../../../common-adapters'
import {type MenuItem} from '../../../../common-adapters/popup-menu'
import {type RetentionPolicy} from '../../../../constants/types/teams'
import {retentionPolicies, baseRetentionPolicies} from '../../../../constants/teams'
import {daysToLabel} from '../../../../util/timestamp'

export type Props = {
  containerStyle?: StylesCrossPlatform,
  dropdownStyle?: StylesCrossPlatform,
  policy: RetentionPolicy,
  teamPolicy?: RetentionPolicy,
  loading: boolean, // for when we're waiting to fetch the team policy
  showInheritOption: boolean,
  showOverrideNotice: boolean,
  type: 'simple' | 'auto',
  setRetentionPolicy: (policy: RetentionPolicy) => void,
  onSelect: (policy: RetentionPolicy, changed: boolean, decreased: boolean) => void,
  onShowDropdown: (items: Array<MenuItem | 'Divider' | null>, target: ?Element) => void,
  onShowWarning: (days: number, onConfirm: () => void, onCancel: () => void) => void,
}

type State = {
  selected: RetentionPolicy,
  items: Array<MenuItem | 'Divider' | null>,
  showMenu: boolean,
}

class RetentionPicker extends React.Component<Props, State> {
  state = {
    selected: retentionPolicies.policyRetain,
    items: [],
    showMenu: false,
  }

  // We just updated the state with a new selection, do we show the warning
  // dialog ourselves or do we call back up to the parent?
  _handleSelection = () => {
    const selected = this.state.selected
    const changed = !policyEquals(this.state.selected, this.props.policy)
    const decreased =
      policyToComparable(selected, this.props.teamPolicy) <
      policyToComparable(this.props.policy, this.props.teamPolicy)
    if (this.props.type === 'simple') {
      this.props.onSelect(selected, changed, decreased)
      return
    }
    // auto case; show dialog if decreased, set immediately if not
    if (!changed) {
      // noop
      return
    }
    const onConfirm = () => this.props.setRetentionPolicy(selected)
    const onCancel = this._init
    if (decreased) {
      // show warning
      this.props.onShowWarning(policyToDays(selected, this.props.teamPolicy), onConfirm, onCancel)
      return
    }
    // set immediately
    onConfirm()
  }

  _onSelect = (selected: RetentionPolicy) => {
    this.setState({selected}, this._handleSelection)
  }

  _makeItems = () => {
    const policies = baseRetentionPolicies.slice()
    if (this.props.showInheritOption) {
      policies.unshift(retentionPolicies.policyInherit)
    }
    const items = policies.map(policy => {
      if (policy.type === 'retain') {
        return {title: 'Keep forever', onClick: () => this._onSelect(policy)}
      } else if (policy.type === 'inherit') {
        if (this.props.teamPolicy) {
          return {title: policyToInheritLabel(this.props.teamPolicy), onClick: () => this._onSelect(policy)}
        } else {
          throw new Error(`Got policy of type 'inherit' without an inheritable parent policy`)
        }
      }
      return {title: daysToLabel(policy.days), onClick: () => this._onSelect(policy)}
    })
    this.setState({items})
  }

  _setInitialSelected = (policy?: RetentionPolicy) => {
    const p = policy || this.props.policy
    this.setState({selected: p})
    // tell parent that nothing has changed
    this.props.type === 'simple' && this.props.onSelect(p, false, false)
  }

  _label = () => {
    return policyToLabel(this.state.selected, this.props.teamPolicy)
  }

  _init = () => {
    this._makeItems()
    this._setInitialSelected()
  }

  componentDidMount() {
    this._init()
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
    return (
      <Box style={collapseStyles([globalStyles.flexBoxColumn, this.props.containerStyle])}>
        <Box style={headingStyle}>
          <Text type="BodySmallSemibold">Message deletion</Text>
          <Icon type="iconfont-timer" style={{fontSize: 16, marginLeft: globalMargins.xtiny}} />
        </Box>
        <ClickableBox
          onClick={this._onShowDropdown}
          style={collapseStyles([dropdownStyle, this.props.dropdownStyle])}
          underlayColor={globalColors.white_40}
        >
          <Box style={labelStyle}>
            <Text type="BodySemibold">{this._label()}</Text>
          </Box>
          <Icon type="iconfont-caret-down" inheritColor={true} style={{fontSize: 7}} />
        </ClickableBox>
        {this.props.showOverrideNotice && (
          <Text style={{marginTop: globalMargins.xtiny}} type="BodySmall">
            Individual channels can override this.
          </Text>
        )}
      </Box>
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
const policyToLabel = (p: RetentionPolicy, parent: ?RetentionPolicy) => {
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
const policyToInheritLabel = (p: RetentionPolicy) => {
  const label = policyToLabel(p)
  return `Use team default (${label})`
}
// Use only for comparing policy durations
const policyToComparable = (p: RetentionPolicy, parent: ?RetentionPolicy): number => {
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
// For getting the number of days a retention policy resolves to
const policyToDays = (p: RetentionPolicy, parent?: RetentionPolicy) => {
  let days = 0
  switch (p.type) {
    case 'inherit':
      if (!parent) {
        throw new Error(`Got policy of type 'inherit' with no inheritable policy`)
      }
      days = policyToDays(parent)
      break
    case 'expire':
      days = p.days
  }
  return days
}
const policyEquals = (p1?: RetentionPolicy, p2?: RetentionPolicy): boolean => {
  if (p1 && p2) {
    return p1.type === p2.type && p1.days === p2.days
  }
  return p1 === p2
}

// Switcher to avoid having RetentionPicker try to process nonexistent data
const RetentionSwitcher = (props: Props) =>
  props.loading ? <ProgressIndicator style={progressIndicatorStyle} /> : <RetentionPicker {...props} />

export default RetentionSwitcher
