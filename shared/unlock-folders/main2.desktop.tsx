import UnlockFolders from './remote-container.desktop'
import load from '../desktop/remote/component-loader.desktop'
import {deserialize} from './remote-serializer.desktop'

load({
  child: (p: any) => <UnlockFolders {...p} />,
  deserialize,
  name: 'unlock-folders',
})
