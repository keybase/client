import * as Container from '../../../util/container'
import DeviceSelector from '.'

type OwnProps = {}

export default Container.connect(
  state => ({
    devices: [],
  }),
  dispatch => ({
    onSelect: (name: string) => null,
    onResetAccount: () => null,
  }),
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(DeviceSelector)
