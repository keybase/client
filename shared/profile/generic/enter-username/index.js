// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {SiteIcon} from '../shared'
import type {SiteIconSet} from '../../../constants/types/tracker2'

type InputProps = {|
  error: boolean,
  onChangeUsername: string => void,
  onEnterKeyDown: () => void,
  serviceIcon: SiteIconSet,
  serviceSuffix: string,
  username: string,
|}

type InputState = {|
  focus: boolean,
  username: string,
|}

class EnterUsernameInput extends React.Component<InputProps, InputState> {
  state = {focus: false, username: this.props.username}

  _onChangeUsername = username => {
    this.props.onChangeUsername(username)
    this.setState({username})
  }

  _setFocus = focus => this.setState(s => (s.focus === focus ? null : {focus}))
  _onFocus = () => this._setFocus(true)
  _onBlur = () => this._setFocus(false)

  render() {
    return (
      <Kb.Box2
        direction="vertical"
        style={Styles.collapseStyles([
          styles.inputBox,
          this.state.username && styles.inputBoxSmall,
          this.state.focus && styles.borderBlue,
          this.props.error && styles.borderRed,
        ])}
        fullWidth={true}
      >
        {!!this.state.username && (
          <Kb.Text type="BodySmallSemibold" style={styles.colorBlue}>
            Your username
          </Kb.Text>
        )}
        <Kb.Box2 direction="horizontal" gap="xtiny" alignItems="center" fullWidth={true}>
          <SiteIcon
            set={this.props.serviceIcon}
            full={false}
            style={this.state.username ? styles.opacity75 : styles.opacity40}
          />
          <Kb.Box2 direction="horizontal" style={styles.positionRelative} fullWidth={true}>
            <Kb.PlainInput
              autoFocus={true}
              flexable={true}
              textType="BodySemibold"
              value={this.state.username}
              onChangeText={this._onChangeUsername}
              onEnterKeyDown={this.props.onEnterKeyDown}
              onFocus={this._onFocus}
              onBlur={this._onBlur}
              style={styles.input}
            />
            <Kb.Box2 direction="horizontal" style={styles.inputPlaceholder} pointerEvents="none">
              <Kb.Text type="BodySemibold" lineClamp={1} style={styles.paddingRightTiny}>
                <Kb.Text
                  type="BodySemibold"
                  style={Styles.collapseStyles([
                    styles.placeholder,
                    !!this.state.username && styles.invisible,
                  ])}
                >
                  {this.state.username || 'Your username'}
                </Kb.Text>
                <Kb.Text type="BodySemibold" style={styles.placeholderService}>
                  {this.props.serviceSuffix}
                </Kb.Text>
              </Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

const Unreachable = props => (
  <Kb.Box2
    direction="horizontal"
    gap="xtiny"
    alignItems="flex-start"
    style={Styles.collapseStyles([styles.inputBox, styles.unreachableBox])}
    fullWidth={Styles.isMobile}
  >
    <SiteIcon
      set={props.serviceIcon}
      full={false}
      style={Styles.collapseStyles([styles.opacity75, styles.inlineIcon])}
    />
    <Kb.Box2 direction="vertical" style={styles.flexOne}>
      <Kb.Text type="BodySemibold" style={styles.placeholder}>
        <Kb.Text type="BodySemibold" style={styles.colorRed}>
          {props.username}
        </Kb.Text>
        {props.serviceSuffix}
      </Kb.Text>
      <Kb.Meta title="unreachable" backgroundColor={Styles.globalColors.red} />
    </Kb.Box2>
    <Kb.Icon
      type="iconfont-proof-broken"
      color={Styles.globalColors.red}
      boxStyle={styles.marginLeftAuto}
      style={Kb.iconCastPlatformStyles(styles.inlineIcon)}
    />
  </Kb.Box2>
)

type Props = {|
  error: string,
  onBack: () => void,
  onCancel: () => void,
  onChangeUsername: string => void,
  onContinue: () => void,
  onSubmit: () => void,
  serviceIcon: SiteIconSet,
  serviceIconFull: SiteIconSet,
  serviceName: string,
  serviceSub: string,
  serviceSuffix: string,
  submitButtonLabel: string,
  unreachable: boolean,
  username: string,
  waiting: boolean, // waiting goes true -> false when proof is complete
|}

class _EnterUsername extends React.Component<Props> {
  componentDidUpdate(prevProps: Props) {
    if (!this.props.waiting && prevProps.waiting) {
      this.props.onContinue()
    }
  }
  render() {
    const props = this.props
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
        {!props.unreachable && !Styles.isMobile && (
          <Kb.BackButton onClick={props.onBack} style={styles.backButton} />
        )}
        <Kb.Box2
          alignItems="center"
          direction="vertical"
          gap="xtiny"
          style={styles.serviceIconHeaderContainer}
        >
          <Kb.Box2 direction="vertical" style={styles.positionRelative}>
            <SiteIcon set={props.serviceIconFull} full={true} style={styles.serviceIconFull} />
            <Kb.Icon
              type={props.unreachable ? 'icon-proof-broken' : 'icon-proof-unfinished'}
              style={styles.serviceProofIcon}
            />
          </Kb.Box2>
          <Kb.Box2 direction="vertical" alignItems="center">
            <Kb.Text type="BodySemibold">{props.serviceName}</Kb.Text>
            <Kb.Text type="BodySmall">{props.serviceSub}</Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Box2
          fullWidth={true}
          direction="vertical"
          alignItems="flex-start"
          gap="xtiny"
          style={styles.inputContainer}
        >
          {props.unreachable ? (
            <Unreachable
              serviceIcon={props.serviceIcon}
              serviceSuffix={props.serviceSuffix}
              username={props.username}
            />
          ) : (
            <EnterUsernameInput
              error={!!props.error}
              serviceIcon={props.serviceIcon}
              serviceSuffix={props.serviceSuffix}
              username={props.username}
              onChangeUsername={props.onChangeUsername}
              onEnterKeyDown={props.onSubmit}
            />
          )}
          {!!props.error && <Kb.Text type="BodySmallError">{props.error}</Kb.Text>}
        </Kb.Box2>
        <Kb.Box2
          alignItems="center"
          fullWidth={true}
          direction="vertical"
          style={props.unreachable ? styles.buttonBarWarning : null}
        >
          {props.unreachable && (
            <Kb.Text type="BodySmallSemibold" center={true} style={styles.warningText}>
              You need to authorize your proof on {props.serviceName}.
            </Kb.Text>
          )}
          <Kb.ButtonBar direction="row" fullWidth={true} style={styles.buttonBar}>
            {!Styles.isMobile && !props.unreachable && (
              <Kb.Button type="Secondary" onClick={props.onBack} label="Cancel" style={styles.buttonSmall} />
            )}
            {props.unreachable ? (
              <Kb.Button
                type="PrimaryGreen"
                onClick={props.onSubmit}
                label={props.submitButtonLabel}
                style={styles.buttonBig}
              />
            ) : (
              <Kb.WaitingButton
                type="PrimaryGreen"
                onClick={props.onSubmit}
                label={props.submitButtonLabel}
                style={styles.buttonBig}
                waitingKey={null}
              />
            )}
          </Kb.ButtonBar>
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}
const EnterUsername = Kb.HeaderOrPopup(_EnterUsername)

const styles = Styles.styleSheetCreate({
  backButton: {left: Styles.globalMargins.small, position: 'absolute', top: Styles.globalMargins.small},
  borderBlue: {borderColor: Styles.globalColors.blue},
  borderRed: {borderColor: Styles.globalColors.red},
  buttonBar: {
    ...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.medium, Styles.globalMargins.medium),
  },
  buttonBarWarning: {backgroundColor: Styles.globalColors.yellow},
  buttonBig: {flex: 2.5},
  buttonSmall: {flex: 1},
  colorBlue: {color: Styles.globalColors.blue},
  colorRed: {color: Styles.globalColors.red},
  container: Styles.platformStyles({isElectron: {height: 485, width: 560}}),
  flexOne: {flex: 1},
  inlineIcon: {
    position: 'relative',
    top: 1,
  },
  input: Styles.platformStyles({
    common: {marginRight: Styles.globalMargins.medium},
    isElectron: {
      marginTop: -1,
    },
    isMobile: {
      top: 3,
    },
  }),
  inputBox: {
    ...Styles.padding(Styles.globalMargins.xsmall),
    borderColor: Styles.globalColors.black_10,
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
    borderWidth: 1,
    padding: Styles.globalMargins.xsmall,
  },
  inputBoxSmall: {
    ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.xsmall),
  },
  inputContainer: {
    ...Styles.padding(0, Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.medium),
    flex: 1,
    justifyContent: 'center',
  },
  inputPlaceholder: {
    left: 1,
    position: 'absolute',
    right: 0,
    top: 1,
  },
  invisible: {
    opacity: 0,
  },
  marginLeftAuto: {marginLeft: 'auto'},
  opacity40: {
    opacity: 0.4,
  },
  opacity75: {
    opacity: 0.75,
  },
  paddingRightTiny: {paddingRight: Styles.globalMargins.tiny},
  placeholder: {
    color: Styles.globalColors.black_40,
  },
  placeholderService: {
    color: Styles.globalColors.black_20,
  },
  positionRelative: {
    position: 'relative',
  },
  serviceIconFull: {
    height: 64,
    width: 64,
  },
  serviceIconHeaderContainer: {
    paddingTop: Styles.globalMargins.medium,
  },
  serviceProofIcon: {bottom: 0, position: 'absolute', right: 0},
  unreachableBox: Styles.platformStyles({
    common: {...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.xsmall)},
    isElectron: {width: 360},
  }),
  warningText: {color: Styles.globalColors.brown_75, marginTop: Styles.globalMargins.small},
})

export default EnterUsername
