import UnlockFolders from './remote-container.desktop'
import load from '../desktop/remote/component-loader.desktop'
import {deserialize, type SerializeProps, type DeserializeProps} from './remote-serializer.desktop'

load<DeserializeProps, SerializeProps>({
  child: (p: DeserializeProps) => <UnlockFolders {...p} />,
  deserialize,
  name: 'unlock-folders',
})
