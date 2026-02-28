import Tracker2 from './remote-container.desktop'
import * as Kb from '@/common-adapters'
import load from '../desktop/remote/component-loader.desktop'
import {deserialize, type SerializeProps, type DeserializeProps} from './remote-serializer.desktop'

const username = /\?param=(\w+)/.exec(window.location.search)

load<DeserializeProps, SerializeProps>({
  child: (p: DeserializeProps) => <Tracker2 {...p} />,
  deserialize,
  name: 'tracker2',
  params: username?.[1] ?? '',
  style: Kb.Styles.platformStyles({
    isElectron: {
      backgroundColor: Kb.Styles.globalColors.transparent,
      borderRadius: 8,
      display: 'block',
      height: '100%',
      overflow: 'hidden',
      width: '100%',
    },
  }),
})
