import * as Container from '../../../util/container'
import DeviceSelector from '.'

type OwnProps = {}

export default Container.connect(
  state => ({
    devices: state.recoverPassword.devices || [],
  }),
  _ => ({
    onSelect: (_: string) => null,
    onResetAccount: () => null,
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(DeviceSelector)
