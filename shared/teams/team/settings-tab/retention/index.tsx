import * as React from 'react'
import * as Container from '../../../../util/container'
import * as TeamsGen from '../../../../actions/teams-gen'
import * as Styles from '../../../../styles'
import * as Kb from '../../../../common-adapters'
import * as TeamsTypes from '../../../../constants/types/teams'
import {RetentionPolicy} from '../../../../constants/types/retention-policy'
import {retentionPolicies, baseRetentionPolicies} from '../../../../constants/teams'
import SaveIndicator from '../../../../common-adapters/save-indicator'

export type RetentionEntityType = 'adhoc' | 'channel' | 'small team' | 'big team'

export type Props = {
  canSetPolicy: boolean
  containerStyle?: Styles.StylesCrossPlatform
  dropdownStyle?: Styles.StylesCrossPlatform
  policy: RetentionPolicy
  policyIsExploding: boolean
  teamPolicy?: RetentionPolicy
  load?: () => void
  loading: boolean // for when we're waiting to fetch the team policy
  showInheritOption: boolean
  showOverrideNotice: boolean
  showSaveIndicator: boolean
  teamID: TeamsTypes.TeamID
  saveRetentionPolicy: (policy: RetentionPolicy) => void
  onSelect?: (policy: RetentionPolicy, changed: boolean, decreased: boolean) => void
  onShowWarning: (policy: RetentionPolicy, onConfirm: () => void, onCancel: () => void) => void
}

type State = {
  saving: boolean
  selected: RetentionPolicy
  items: Kb.MenuItems
}

type PropsWithOverlay<P> = {} & P & Kb.OverlayParentProps

class _RetentionPicker extends React.Component<PropsWithOverlay<Props>, State> {
  state = {
    items: [],
    saving: false,
    selected: retentionPolicies.policyRetain,
  }
  _timeoutID: ReturnType<typeof setInterval> | undefined
  _showSaved: boolean = false

  _handleSelection = () => {
    const selected = this.state.selected
    const changed = !policyEquals(this.state.selected, this.props.policy)
    const decreased =
      policyToComparable(selected, this.props.teamPolicy) <
      policyToComparable(this.props.policy, this.props.teamPolicy)

    // show dialog if decreased, set immediately if not
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
    const items = policies.reduce<State['items']>((arr, policy) => {
      switch (policy.type) {
        case 'retain':
        case 'expire':
          return [...arr, {onClick: () => this._onSelect(policy), title: policy.title}] as Kb.MenuItems
        case 'inherit':
          if (this.props.teamPolicy) {
            let title = ''
            switch (this.props.teamPolicy.type) {
              case 'retain':
                title = 'Team default (Never)'
                break
              case 'expire':
              case 'explode':
                title = `Team default (${this.props.teamPolicy.title})`
                break
            }
            return [
              {
                onClick: () => this._onSelect(policy),
                title,
              },
              'Divider',
              ...arr,
            ] as Kb.MenuItems
          } else {
            throw new Error(`Got policy of type 'inherit' without an inheritable parent policy`)
          }
        case 'explode':
          return [
            ...arr,
            {
              icon: 'iconfont-timer',
              onClick: () => this._onSelect(policy),
              title: policy.title,
            },
          ] as Kb.MenuItems
      }
      return arr
    }, [])
    this.setState({items})
  }

  _setInitialSelected = (policy?: RetentionPolicy) => {
    const p = policy || this.props.policy
    this.setState({selected: p})
  }

  _label = () => {
    return policyToLabel(this.state.selected, this.props.teamPolicy || null)
  }

  _init = () => {
    this._makeItems()
    this._setInitialSelected()
  }

  componentDidMount() {
    this._init()
  }

  componentDidUpdate(prevProps: PropsWithOverlay<Props>) {
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
        <Kb.Box style={styles.heading}>
          <Kb.Text type="BodySmallSemibold">Message deletion</Kb.Text>
        </Kb.Box>
        <Kb.ClickableBox
          onClick={this.props.toggleShowingMenu}
          ref={this.props.setAttachmentRef}
          style={Styles.collapseStyles([styles.retentionDropdown, this.props.dropdownStyle])}
          underlayColor={Styles.globalColors.white_40}
        >
          <Kb.Box2
            direction="horizontal"
            alignItems="center"
            gap="tiny"
            fullWidth={true}
            style={styles.label}
          >
            {this._label()}
          </Kb.Box2>
          <Kb.Icon type="iconfont-caret-down" inheritColor={true} fontSize={7} sizeType="Tiny" />
        </Kb.ClickableBox>
        {this.props.policyIsExploding && (
          <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} gap="xtiny">
            <Kb.Text type="BodySmall">Participants will see their message explode.</Kb.Text>
            <Kb.Icon color={Styles.globalColors.black_50} sizeType="Big" type="iconfont-boom" />
          </Kb.Box2>
        )}
        {this.props.showOverrideNotice && (
          <Kb.Text type="BodySmall">Individual channels can override this.</Kb.Text>
        )}
        {this.props.showSaveIndicator && (
          <SaveIndicator
            saving={this.state.saving}
            style={styles.saveState}
            minSavingTimeMs={300}
            savedTimeoutMs={2500}
          />
        )}
      </Kb.Box>
    )
  }
}
const RetentionPicker = Kb.OverlayParentHOC(_RetentionPicker)

const RetentionDisplay = (
  props: {
    entityType: RetentionEntityType
  } & Props
) => {
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
      <Kb.Box style={Styles.collapseStyles([styles.heading, styles.displayHeading])}>
        <Kb.Text type="BodySmallSemibold">Message deletion</Kb.Text>
      </Kb.Box>
      <Kb.Text type="BodySmall">{text}</Kb.Text>
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  displayHeading: {
    marginBottom: 2,
  },
  heading: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    marginBottom: Styles.globalMargins.tiny,
  },
  label: {
    justifyContent: 'flex-start',
    minHeight: Styles.isMobile ? 40 : 32,
    paddingLeft: Styles.globalMargins.xsmall,
  },
  progressIndicator: {
    height: 30,
    marginTop: Styles.globalMargins.small,
    width: 30,
  },
  retentionDropdown: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      borderColor: Styles.globalColors.grey,
      borderRadius: Styles.borderRadius,
      borderStyle: 'solid',
      borderWidth: 1,
      marginBottom: Styles.globalMargins.tiny,
      minWidth: 220,
      paddingRight: Styles.globalMargins.small,
    },
    isElectron: {
      width: 220,
    },
  }),
  saveState: Styles.platformStyles({
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
  }),
}))

// Utilities for transforming retention policies <-> labels
const policyToLabel = (p: RetentionPolicy, parent: RetentionPolicy | null) => {
  let text = ''
  let timer = false
  switch (p.type) {
    case 'retain':
      text = 'Never auto-delete'
      break
    case 'expire':
    case 'explode':
      text = p.title
      timer = p.type === 'explode'
      break
    case 'inherit':
      if (!parent) {
        // Don't throw an error, as this may happen when deleting a
        // channel.
        text = 'Team default'
        break
      }
      switch (parent.type) {
        case 'retain':
          text = 'Team default (Never)'
          break
        case 'expire':
        case 'explode':
          text = `Team default (${parent.title})`
          timer = parent.type === 'explode'
          break
      }
  }
  return [
    timer ? <Kb.Icon color={Styles.globalColors.black} type="iconfont-timer" key="timer" /> : null,
    <Kb.Text type="BodySemibold" key="label">
      {text}
    </Kb.Text>,
  ]
}
// Use only for comparing policy durations
const policyToComparable = (p: RetentionPolicy, parent?: RetentionPolicy): number => {
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
      {
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
            behavior = `expire after ${parent.title}`
            break
          case 'explode':
            behavior = `explode after ${parent.title}`
            break
          default:
            throw new Error(`Impossible policy type encountered: ${parent.type}`)
        }
        exp = `Messages in this ${convType} will ${behavior}, which is the team default.`
      }
      break
    case 'retain':
      exp = `Admins have set this ${convType} to retain messages indefinitely.`
      break
    case 'expire':
      exp = `Admins have set this ${convType} to auto-delete messages after ${p.title}.`
      break
    case 'explode':
      exp = `Admins have set messages in this ${convType} to explode after ${p.title}.`
      break
    default:
      throw new Error(`Impossible policy type encountered: ${p.type}`)
  }
  return exp
}

// Switcher to avoid having RetentionPicker try to process nonexistent data
const RetentionSwitcher = (
  props: {
    entityType: RetentionEntityType
  } & Props
) => {
  const {teamID} = props
  const dispatch = Container.useDispatch()
  React.useEffect(() => {
    dispatch(TeamsGen.createGetTeamRetentionPolicy({teamID}))
  }, [dispatch, teamID])
  if (props.loading) {
    return <Kb.ProgressIndicator style={styles.progressIndicator} />
  }
  const {entityType, ...pickerProps} = props
  return props.canSetPolicy ? <RetentionPicker {...pickerProps} /> : <RetentionDisplay {...props} />
}

export default RetentionSwitcher
