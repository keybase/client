import * as Styles from '../styles'
import Tracker2 from './remote-container.desktop'
import load from '../desktop/remote/component-loader.desktop'
import {deserialize} from './remote-serializer.desktop'

const username = /\?param=(\w+)/.exec(window.location.search)

load({
  child: <Tracker2 />,
  deserialize,
  name: 'tracker2',
  params: username?.[1] ?? '',
  style: {
    backgroundColor: Styles.globalColors.transparent,
    borderRadius: 8,
    display: 'block',
    height: '100%',
    overflow: 'hidden',
    width: '100%',
  },
})
