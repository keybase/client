import * as Constants from '../constants/provision'
import * as ARConstants from '../constants/autoreset'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as ProvisionGen from '../actions/provision-gen'
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Styles from '../styles'
import DeviceIcon from '../devices/device-icon'
import type * as Types from '../constants/types/provision'
import {SignupScreen} from '../signup/common'

const SelectOtherDeviceContainer = () => {
  const devices = Container.useSelector(state => state.provision.devices)
  const username = Container.useSelector(state => state.provision.username)
  const waiting = Container.useAnyWaiting(Constants.waitingKey)

  const dispatch = Container.useDispatch()
  const _onBack = React.useCallback(() => {
    dispatch(RouteTreeGen.createNavigateUp())
  }, [dispatch])
  const onBack = Container.useSafeSubmit(_onBack, false)
  const startAccountReset = ARConstants.useState(s => s.dispatch.startAccountReset)
  const onResetAccount = React.useCallback(() => {
    startAccountReset(false, username)
  }, [startAccountReset, username])
  const _onSelect = React.useCallback(
    (name: string) => {
      !waiting && dispatch(ProvisionGen.createSubmitDeviceSelect({name}))
    },
    [dispatch, waiting]
  )
  const onSelect = Container.useSafeSubmit(_onSelect, false)
  return (
    <SelectOtherDevice
      devices={devices}
      onBack={onBack}
      onSelect={onSelect}
      onResetAccount={onResetAccount}
    />
  )
}
export default SelectOtherDeviceContainer

type Props = {
  passwordRecovery?: boolean
  devices: ReadonlyArray<Types.Device>
  onBack: () => void
  onSelect: (name: string) => void
  onResetAccount: () => void
}

const resetSignal = 'reset'
type DeviceOrReset = Types.Device | 'reset'
export class SelectOtherDevice extends React.Component<Props> {
  _renderItem = (index, item: DeviceOrReset) => {
    if (item === resetSignal) {
      return (
        <Kb.Box2 direction="vertical" fullWidth={true} key="reset">
          <Kb.Text type="BodySmall" style={styles.or}>
            or
          </Kb.Text>
          <Kb.ListItem2
            type="Small"
            firstItem={true}
            key="reset"
            onClick={this.props.onResetAccount}
            icon={<Kb.Icon type="icon-skull-32" />}
            body={
              <Kb.Box2 direction="vertical" fullWidth={true}>
                <Kb.Text type="BodySemibold">I lost all my devices/paper keys</Kb.Text>
                <Kb.Text type="BodySmall">Reset your account</Kb.Text>
              </Kb.Box2>
            }
          />
        </Kb.Box2>
      )
    }

    const descriptions = {
      backup: 'Paper key',
      desktop: 'Computer',
      mobile: 'Phone',
    }
    const {name, type} = item
    return (
      <Kb.ListItem2
        type="Small"
        firstItem={index === 0}
        key={name}
        onClick={() => this.props.onSelect(name)}
        icon={<DeviceIcon device={item} size={32} />}
        body={
          <Kb.Box2 direction="vertical" fullWidth={true}>
            <Kb.Text type="BodySemibold">{name}</Kb.Text>
            <Kb.Text type="BodySmall">{descriptions[type]}</Kb.Text>
          </Kb.Box2>
        }
      />
    )
  }

  render() {
    const items: DeviceOrReset[] = [...this.props.devices, resetSignal]
    return (
      <SignupScreen
        noBackground={true}
        onBack={this.props.onBack}
        title={
          this.props.passwordRecovery
            ? 'Recover password'
            : `Authorize this ${Styles.isMobile ? 'device' : 'computer'}`
        }
        contentContainerStyle={Styles.padding(0)}
      >
        <Kb.Box2
          direction="vertical"
          fullHeight={true}
          fullWidth={true}
          style={styles.contentBox}
          gap="medium"
        >
          <Kb.List
            style={styles.list}
            items={items}
            renderItem={this._renderItem}
            keyProperty="name"
            ListHeaderComponent={
              <Kb.Box2 direction="vertical" style={styles.headerText}>
                {!this.props.passwordRecovery && (
                  <Kb.Text center={true} type="Body">
                    For security reasons, you need to authorize this {Styles.isMobile ? 'phone' : 'computer'}{' '}
                    with another device or a paper key.
                  </Kb.Text>
                )}
                <Kb.Text center={true} type="Body">
                  Which do you have handy?
                </Kb.Text>
              </Kb.Box2>
            }
          />
        </Kb.Box2>
      </SignupScreen>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  contentBox: Styles.platformStyles({
    common: {alignSelf: 'center', flexGrow: 1},
    isElectron: {
      maxWidth: 460,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
  }),
  headerText: Styles.platformStyles({
    common: {
      paddingBottom: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.small,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.small,
    },
  }),
  list: {
    flexGrow: 1,
  },
  or: {
    backgroundColor: Styles.globalColors.blueGrey,
    color: Styles.globalColors.black_50,
    ...Styles.padding(Styles.globalMargins.xsmall),
  },
}))
