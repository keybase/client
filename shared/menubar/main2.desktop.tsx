import Menubar from './remote-container.desktop'
import * as Kb from '@/common-adapters'
import load from '../desktop/remote/component-loader.desktop'
import {deserialize, type SerializeProps, type DeserializeProps} from './remote-serializer.desktop'

// This is to keep that arrow and gap on top w/ transparency
const style = {
  ...Kb.Styles.globalStyles.flexBoxColumn,
  borderTopLeftRadius: 4,
  borderTopRightRadius: 4,
  flex: 1,
  marginTop: 0,
  position: 'relative',
} as const

load<DeserializeProps, SerializeProps>({
  child: (p: DeserializeProps) => <Menubar {...p} />,
  deserialize,
  name: 'menubar',
  showOnProps: false,
  style,
})
