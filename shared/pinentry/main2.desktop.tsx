import Pinentry from './remote-container.desktop'
import load from '../desktop/remote/component-loader.desktop'
import {deserialize} from './remote-serializer.desktop'

const sessionID = /\?param=(\w+)/.exec(window.location.search)

load({
  child: <Pinentry />,
  deserialize,
  name: 'pinentry',
  params: sessionID?.[1] ?? '',
})
