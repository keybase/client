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
import {Box, ClickableBox, FloatingMenu, Icon, ProgressIndicator, Text} from '../../../../common-adapters'
import {type MenuItem} from '../../../../common-adapters/floating-menu/menu-layout'
import type {RetentionPolicy} from '../../../../constants/types/retention-policy'
import {retentionPolicies, baseRetentionPolicies} from '../../../../constants/teams'
import {daysToLabel} from '../../../../util/timestamp'
import SaveIndicator from '../../../../common-adapters/save-indicator'

export type RetentionEntityType = 'adhoc' | 'channel' | 'small team' | 'big team'

export type Props = {
  canSetPolicy: boolean,
  containerStyle?: StylesCrossPlatform,
  dropdownStyle?: StylesCrossPlatform,
  policy: RetentionPolicy,
  teamPolicy?: RetentionPolicy,
  loading: boolean, // for when we're waiting to fetch the team policy
  showInheritOption: boolean,
  showOverrideNotice: boolean,
  showSaveIndicator: boolean,
  type: 'simple' | 'auto',
  saveRetentionPolicy: (policy: RetentionPolicy) => void,
  onSelect: (policy: RetentionPolicy, changed: boolean, decreased: boolean) => void,
  onShowWarning: (days: number, onConfirm: () => void, onCancel: () => void) => void,
}

type State = {
  saving: boolean,
  selected: RetentionPolicy,
  items: Array<MenuItem | 'Divider' | null>,
  showMenu: boolean,
  prevPolicy: RetentionPolicy,
  prevTeamPolicy?: RetentionPolicy,
}

class RetentionPicker extends React.Component<Props, State> {
  state = {
    saving: false,
    selected: retentionPolicies.policyRetain,
    items: [],
    showMenu: false,
    prevPolicy: retentionPolicies.policyRetain,
    prevTeamPolicy: retentionPolicies.policyRetain,
  }
  _timeoutID: TimeoutID
  _showSaved: boolean
  _dropdownRef: ?ClickableBox

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
    const onConfirm = () => {
      this.props.saveRetentionPolicy(selected)
    }
    const onCancel = this._init
    if (decreased) {
      // show warning
      this._showSaved = false
      this.props.onShowWarning(policyToDays(selected, this.props.teamPolicy), onConfirm, onCancel)
      return
    }
    // set immediately
    onConfirm()
    this._showSaved = true
    this._setSaving(true)
  }

  _onSelect = (selected: RetentionPolicy) => {
    this.setState({selected}, this._handleSelection)
  }

  _setSaving = (saving: boolean) => {
    this.setState({saving})
  }

  _toggleShowMenu = () =>
    this.setState(prevState => ({
      showMenu: !prevState.showMenu,
    }))

  _setDropdownRef = ref => (this._dropdownRef = ref)
  _getDropdownRef = () => this._dropdownRef

  _makeItems = () => {
    const policies = baseRetentionPolicies.slice()
    if (this.props.showInheritOption) {
      policies.unshift(retentionPolicies.policyInherit)
    }
    const items = policies.map(policy => {
      if (policy.type === 'retain') {
        return {title: 'Never auto-delete', onClick: () => this._onSelect(policy)}
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

  static getDerivedStateFromProps(props, state) {
    if (
      !policyEquals(props.policy, state.prevPolicy) ||
      !policyEquals(props.teamPolicy, state.prevTeamPolicy)
    ) {
      let saving = state.saving
      if (policyEquals(props.policy, state.selected)) {
        // we just got updated retention policy matching the selected one
        saving = false
      } // we could show a notice that we received a new value in an else block
      return {
        ...state,
        items: null, // to be populated in componentDidUpdate
        saving,
        prevPolicy: props.policy,
        prevTeamPolicy: props.teamPolicy,
      }
    }
    // Return null to indicate no change to state.
    return null
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.items === null) {
      this._makeItems()
      this._setInitialSelected(this.props.policy)
    }
  }

  render() {
    return (
      <Box style={collapseStyles([globalStyles.flexBoxColumn, this.props.containerStyle])}>
        <FloatingMenu
          attachTo={this._getDropdownRef}
          closeOnSelect={true}
          visible={this.state.showMenu}
          onHidden={this._toggleShowMenu}
          items={this.state.items}
          position="top center"
        />
        <Box style={headingStyle}>
          <Text type="BodySmallSemibold">Message deletion</Text>
          <Icon
            type="iconfont-timer"
            style={{marginLeft: globalMargins.xtiny}}
            fontSize={isMobile ? 22 : 16}
            color={globalColors.black_20}
          />
        </Box>
        <ClickableBox
          onClick={this._toggleShowMenu}
          ref={isMobile ? undefined : this._setDropdownRef}
          style={collapseStyles([dropdownStyle, this.props.dropdownStyle])}
          underlayColor={globalColors.white_40}
        >
          <Box style={labelStyle}>
            <Text type="BodySemibold">{this._label()}</Text>
          </Box>
          <Icon type="iconfont-caret-down" inheritColor={true} fontSize={7} />
        </ClickableBox>
        {this.props.showOverrideNotice && (
          <Text style={{marginTop: globalMargins.xtiny}} type="BodySmall">
            Individual channels can override this.
          </Text>
        )}
        {this.props.showSaveIndicator && (
          <SaveIndicator
            saving={this.state.saving}
            style={saveStateStyle}
            minSavingTimeMs={300}
            savedTimeoutMs={2500}
          />
        )}
      </Box>
    )
  }
}

const RetentionDisplay = (props: Props & {entityType: RetentionEntityType}) => {
  let convType = ''
  switch (props.entityType) {
    case 'big team':
      convType = 'team'
      break
    case 'small team':
      convType = 'chat'
      break
    case 'channel':
      convType = 'channel'
      break
    case 'chat':
    default:
      throw new Error(`Bad entityType encountered in RetentionDisplay: ${props.entityType}`)
  }
  const text = policyToExplanation(convType, props.policy, props.teamPolicy)
  return (
    <Box style={collapseStyles([globalStyles.flexBoxColumn, props.containerStyle])}>
      <Box style={displayHeadingStyle}>
        <Text type="BodySmallSemibold">Message deletion</Text>
        <Icon
          type="iconfont-timer"
          color={globalColors.black_20}
          fontSize={isMobile ? 22 : 16}
          style={{marginLeft: globalMargins.xtiny}}
        />
      </Box>
      <Text type="BodySmall">{text}</Text>
    </Box>
  )
}

const headingStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  marginBottom: globalMargins.tiny,
}

const displayHeadingStyle = {
  ...headingStyle,
  marginBottom: 2,
}

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

const labelStyle = {
  ...globalStyles.flexBoxCenter,
  minHeight: isMobile ? 40 : 32,
  width: '100%',
}

const progressIndicatorStyle = {
  width: 30,
  height: 30,
  marginTop: globalMargins.small,
}

const saveStateStyle = platformStyles({
  common: {
    ...globalStyles.flexBoxRow,
    height: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: globalMargins.tiny,
  },
  isMobile: {
    height: globalMargins.medium,
  },
})

// Utilities for transforming retention policies <-> labels
const policyToLabel = (p: RetentionPolicy, parent: ?RetentionPolicy) => {
  switch (p.type) {
    case 'retain':
      return 'Never auto-delete'
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
  return `Team default (${label})`
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
const policyToExplanation = (convType: string, p: RetentionPolicy, parent?: RetentionPolicy) => {
  let exp = ''
  switch (p.type) {
    case 'inherit':
      if (!parent) {
        throw new Error(`Got policy of type 'inherit' with no inheritable policy`)
      }
      let behavior = ''
      switch (parent.type) {
        case 'inherit':
          throw new Error(`Got invalid type 'inherit' for team-wide policy`)
        case 'retain':
          behavior = 'be retained indefinitely'
          break
        case 'expire':
          behavior = `expire after ${daysToLabel(parent.days)}`
          break
        default:
          throw new Error(`Impossible policy type encountered: ${parent.type}`)
      }
      exp = `Messages in this ${convType} will ${behavior}, which is the team default.`
      break
    case 'retain':
      exp = `Admins have set this ${convType} to retain messages indefinitely.`
      break
    case 'expire':
      exp = `Admins have set this ${convType} to auto-delete messages after ${daysToLabel(p.days)}.`
      break
    default:
      throw new Error(`Impossible policy type encountered: ${p.type}`)
  }
  return exp
}

// Switcher to avoid having RetentionPicker try to process nonexistent data
const RetentionSwitcher = (props: Props & {entityType: RetentionEntityType}) => {
  if (props.loading) {
    return <ProgressIndicator style={progressIndicatorStyle} />
  }
  return props.canSetPolicy ? <RetentionPicker {...props} /> : <RetentionDisplay {...props} />
}

export default RetentionSwitcher
