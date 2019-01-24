// @flow
import * as React from 'react'
import * as Styles from '../../../../styles'
import * as Kb from '../../../../common-adapters'
import {type MenuItem} from '../../../../common-adapters/floating-menu/menu-layout'
import type {RetentionPolicy} from '../../../../constants/types/retention-policy'
import {retentionPolicies, baseRetentionPolicies} from '../../../../constants/teams'
import {daysToLabel} from '../../../../util/timestamp'
import SaveIndicator from '../../../../common-adapters/save-indicator'

export type RetentionEntityType = 'adhoc' | 'channel' | 'small team' | 'big team'

export type Props = {|
  canSetPolicy: boolean,
  containerStyle?: Styles.StylesCrossPlatform,
  dropdownStyle?: Styles.StylesCrossPlatform,
  policy: RetentionPolicy,
  teamPolicy?: RetentionPolicy,
  loading: boolean, // for when we're waiting to fetch the team policy
  showInheritOption: boolean,
  showOverrideNotice: boolean,
  showSaveIndicator: boolean,
  type: 'simple' | 'auto',
  saveRetentionPolicy: (policy: RetentionPolicy) => void,
  onSelect: (policy: RetentionPolicy, changed: boolean, decreased: boolean) => void,
  onShowWarning: (policy: RetentionPolicy, onConfirm: () => void, onCancel: () => void) => void,
|}

type State = {
  saving: boolean,
  selected: RetentionPolicy,
  items: Array<MenuItem | 'Divider' | null>,
}

class _RetentionPicker extends React.Component<Kb.PropsWithOverlay<Props>, State> {
  state = {
    items: [],
    saving: false,
    selected: retentionPolicies.policyRetain,
  }
  _timeoutID: TimeoutID
  _showSaved: boolean

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
      this.props.onShowWarning(
        selected.type === 'inherit' && this.props.teamPolicy ? this.props.teamPolicy : selected,
        onConfirm,
        onCancel
      )
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

  _makeItems = () => {
    const policies = baseRetentionPolicies.slice()
    if (this.props.showInheritOption) {
      policies.unshift(retentionPolicies.policyInherit)
    }
    const items = policies.reduce((arr, policy) => {
      switch (policy.type) {
        case 'retain':
        case 'expire':
          return [...arr, {onClick: () => this._onSelect(policy), title: policy.title}]
        case 'inherit':
          if (this.props.teamPolicy) {
            return [
              {onClick: () => this._onSelect(policy), title: policyToInheritLabel(this.props.teamPolicy)},
              'Divider',
              ...arr,
            ]
          } else {
            throw new Error(`Got policy of type 'inherit' without an inheritable parent policy`)
          }
        case 'explode':
          return [
            ...arr,
            {
              onClick: () => this._onSelect(policy),
              title: policy.title,
              view: (
                <Kb.Box2 alignItems="center" direction="horizontal" gap="tiny" fullWidth={true}>
                  <Kb.Icon type="iconfont-timer" />
                  <Kb.Text type="Body">{policy.title}</Kb.Text>
                </Kb.Box2>
              ),
            },
          ]
      }
      return arr
    }, [])
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

  componentDidUpdate(prevProps: Kb.PropsWithOverlay<Props>, prevState: State) {
    if (
      !policyEquals(this.props.policy, prevProps.policy) ||
      !policyEquals(this.props.teamPolicy, prevProps.teamPolicy)
    ) {
      if (policyEquals(this.props.policy, this.state.selected)) {
        // we just got updated retention policy matching the selected one
        this._setSaving(false)
      } // we could show a notice that we received a new value in an else block
      this._makeItems()
      this._setInitialSelected(this.props.policy)
    }
  }

  render() {
    return (
      <Kb.Box style={Styles.collapseStyles([Styles.globalStyles.flexBoxColumn, this.props.containerStyle])}>
        <Kb.FloatingMenu
          attachTo={this.props.getAttachmentRef}
          closeOnSelect={true}
          visible={this.props.showingMenu}
          onHidden={this.props.toggleShowingMenu}
          items={this.state.items}
          position="top center"
        />
        <Kb.Box style={headingStyle}>
          <Kb.Text type="BodySmallSemibold">Message deletion</Kb.Text>
        </Kb.Box>
        <Kb.ClickableBox
          onClick={this.props.toggleShowingMenu}
          ref={this.props.setAttachmentRef}
          style={Styles.collapseStyles([dropdownStyle, this.props.dropdownStyle])}
          underlayColor={Styles.globalColors.white_40}
        >
          <Kb.Box style={labelStyle}>
            <Kb.Text type="BodySemibold">{this._label()}</Kb.Text>
          </Kb.Box>
          <Kb.Icon type="iconfont-caret-down" inheritColor={true} fontSize={7} />
        </Kb.ClickableBox>
        {this.props.showOverrideNotice && (
          <Kb.Text style={{marginTop: Styles.globalMargins.xtiny}} type="BodySmall">
            Individual channels can override this.
          </Kb.Text>
        )}
        {this.props.showSaveIndicator && (
          <SaveIndicator
            saving={this.state.saving}
            style={saveStateStyle}
            minSavingTimeMs={300}
            savedTimeoutMs={2500}
          />
        )}
      </Kb.Box>
    )
  }
}
const RetentionPicker = Kb.OverlayParentHOC(_RetentionPicker)

const RetentionDisplay = (props: {|...Props, entityType: RetentionEntityType|}) => {
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
    default:
      throw new Error(`Bad entityType encountered in RetentionDisplay: ${props.entityType}`)
  }
  const text = policyToExplanation(convType, props.policy, props.teamPolicy)
  return (
    <Kb.Box style={Styles.collapseStyles([Styles.globalStyles.flexBoxColumn, props.containerStyle])}>
      <Kb.Box style={displayHeadingStyle}>
        <Kb.Text type="BodySmallSemibold">Message deletion</Kb.Text>
        <Kb.Icon
          type="iconfont-timer"
          color={Styles.globalColors.black_20}
          fontSize={Styles.isMobile ? 22 : 16}
          style={{marginLeft: Styles.globalMargins.xtiny}}
        />
      </Kb.Box>
      <Kb.Text type="BodySmall">{text}</Kb.Text>
    </Kb.Box>
  )
}

const headingStyle = {
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  marginBottom: Styles.globalMargins.tiny,
}

const displayHeadingStyle = {
  ...headingStyle,
  marginBottom: 2,
}

const dropdownStyle = Styles.platformStyles({
  common: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    borderColor: Styles.globalColors.lightGrey2,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    minWidth: 220,
    paddingRight: Styles.globalMargins.small,
  },
  isElectron: {
    width: 220,
  },
})

const labelStyle = {
  ...Styles.globalStyles.flexBoxCenter,
  minHeight: Styles.isMobile ? 40 : 32,
  width: '100%',
}

const progressIndicatorStyle = {
  height: 30,
  marginTop: Styles.globalMargins.small,
  width: 30,
}

const saveStateStyle = Styles.platformStyles({
  common: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    height: 17,
    justifyContent: 'center',
    marginTop: Styles.globalMargins.tiny,
  },
  isMobile: {
    height: Styles.globalMargins.medium,
  },
})

// Utilities for transforming retention policies <-> labels
const secondsToDays = s => s / (3600 * 24)
const policyToLabel = (p: RetentionPolicy, parent: ?RetentionPolicy) => {
  switch (p.type) {
    case 'retain':
      return 'Never auto-delete'
    case 'expire':
    case 'explode':
      return p.title || daysToLabel(secondsToDays(p.seconds))
    case 'inherit':
      if (!parent) {
        // Don't throw an error, as this may happen when deleting a
        // channel.
        return 'Team default'
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
    case 'explode':
      res = p.seconds
      break
  }
  if (res === -1) {
    // no good
    throw new Error('Impossible case encountered: res = -1 in retention policyToComparable')
  }
  return res
}
const policyEquals = (p1?: RetentionPolicy, p2?: RetentionPolicy): boolean => {
  if (p1 && p2) {
    return p1.type === p2.type && p1.seconds === p2.seconds
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
          behavior = `expire after ${daysToLabel(secondsToDays(parent.seconds))}`
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
      exp = `Admins have set this ${convType} to auto-delete messages after ${daysToLabel(
        secondsToDays(p.seconds)
      )}.`
      break
    default:
      throw new Error(`Impossible policy type encountered: ${p.type}`)
  }
  return exp
}

// Switcher to avoid having RetentionPicker try to process nonexistent data
const RetentionSwitcher = (props: {|...Props, entityType: RetentionEntityType|}) => {
  if (props.loading) {
    return <Kb.ProgressIndicator style={progressIndicatorStyle} />
  }
  const {entityType, ...pickerProps} = props
  return props.canSetPolicy ? <RetentionPicker {...pickerProps} /> : <RetentionDisplay {...props} />
}

export default RetentionSwitcher
