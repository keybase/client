import Pinentry from './remote-container.desktop'
import load from '../desktop/remote/component-loader.desktop'
import {deserialize, type SerializeProps, type DeserializeProps} from './remote-serializer.desktop'

const sessionID = /\?param=(\w+)/.exec(window.location.search)

load<DeserializeProps, SerializeProps>({
  child: (p: DeserializeProps) => <Pinentry {...p} />,
  deserialize,
  name: 'pinentry',
  params: sessionID?.[1] ?? '',
})
