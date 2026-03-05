// Minimal fast Avatar for list rows (desktop). Supports only: size, teamname/username, isTeam.
import type * as React from 'react'
import * as Styles from '@/styles'
import {useConfigState} from '@/stores/config'
import * as AvatarZus from './avatar/store'

type Props = {
  isTeam?: boolean
  size: 128 | 96 | 64 | 48 | 32 | 24 | 16
  teamname?: string
  username?: string
}

function Avatar2(p: Props) {
  const {size, teamname, username, isTeam: _isTeam} = p
  const isTeam = _isTeam || !!teamname
  const name = isTeam ? teamname : username
  const counter = AvatarZus.useAvatarState(s => s.counts.get(name || '') ?? 0)
  const httpSrv = useConfigState(s => s.httpSrv)
  const {address, token} = httpSrv

  const avatarSizeClassName = `avatar-${isTeam ? 'team' : 'user'}-size-${size}`

  let src: string | undefined
  if (address && name) {
    const typ = isTeam ? 'team' : 'user'
    const imgSize = size <= 64 ? 192 : size <= 96 ? 256 : 960
    src = `http://${address}/av?typ=${typ}&name=${name}&format=square_${imgSize}&mode=light&token=${token}&count=${counter}`
  }

  return (
    <div className={Styles.classNames('avatar', avatarSizeClassName)}>
      <div className={Styles.classNames('avatar-inner', avatarSizeClassName)}>
        <div className="avatar-background" />
        {!!src && (
          <img
            key={src}
            src={src}
            decoding="async"
            className="avatar-user-image"
            alt=""
            draggable={false}
          />
        )}
        {isTeam && (
          <div
            style={borderTeamStyle}
            className={Styles.classNames('avatar-border-team', avatarSizeClassName)}
          />
        )}
      </div>
    </div>
  )
}

const borderTeamStyle: React.CSSProperties = {
  boxShadow: `0px 0px 0px 1px ${Styles.globalColors.black_10} inset`,
}

export default Avatar2
