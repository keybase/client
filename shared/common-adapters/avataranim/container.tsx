import AvatarAnim, {Props as AvatarAnimProps} from '.'
import { AvatarSize } from '../avatar'
import {namedConnect, isMobile} from '../../util/container'
import {urlsToImgSet} from '../icon'
import * as Styles from '../../styles'

export type ConnectedAvatarAnimProps = {
  username: string
  size: AvatarSize
}

type OwnProps = ConnectedAvatarAnimProps

const ConnectedAvatarAnim = namedConnect(
  (state, ownProps: OwnProps) => ({
    _counter: state.config.avatarRefreshCounter.get(ownProps.username || '') || 0,
    _httpSrvAddress: state.config.httpSrvAddress,
    _httpSrvToken: state.config.httpSrvToken,
  }),
  () => ({}),
  (
    stateProps,
    _dispatchProps,
    ownProps: OwnProps
  ) => {
    const {username, size, ...props} = ownProps
    const urlMap = [960, 256, 192].reduce((m, size: number) => {
      m[size] = `http://${stateProps._httpSrvAddress}/av?typ=user&name=${username}&format=square_${size}&mode=${Styles.isDarkMode() ? 'dark' : 'light'}&token=${
        stateProps._httpSrvToken
      }&count=${stateProps._counter}`
      return m
    }, {})
    return {
      ...props,
      size,
      url: urlsToImgSet(urlMap, ownProps.size),
    }
  },
  'AvatarAnim')(
  AvatarAnim
)

export default ConnectedAvatarAnim
