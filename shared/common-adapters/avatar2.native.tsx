// Minimal fast Avatar for list rows. Supports only: size, teamname/username, isTeam.
// No onClick, no follow icons, no edit, no blocked, no children, no background layer.
import {useConfigState} from '@/stores/config'
import * as AvatarZus from './avatar/store'
import {Image} from 'expo-image'
import {View} from 'react-native'
import {useColorScheme} from 'react-native'

type Props = {
  isTeam?: boolean
  size: 128 | 96 | 64 | 48 | 32 | 24 | 16
  teamname?: string
  username?: string
}

const sizeToTeamBorderRadius: Record<number, number> = {
  128: 12, 16: 4, 24: 4, 32: 5, 48: 6, 64: 8, 96: 10,
}

// Pre-compute all possible container+image style combos (size x isTeam)
type SizeStyle = {container: {height: number; width: number}; image: {borderRadius: number; height: number; overflow: 'hidden'; width: number}}
const allSizes = [16, 24, 32, 48, 64, 96, 128] as const
const styleCache = new Map<string, SizeStyle>()
for (const size of allSizes) {
  for (const isTeam of [true, false]) {
    const br = isTeam ? (sizeToTeamBorderRadius[size] ?? size / 2) : size / 2
    styleCache.set(`${size}-${isTeam}`, {
      container: {height: size, width: size},
      image: {borderRadius: br, height: size, overflow: 'hidden', width: size},
    })
  }
}

function Avatar2(p: Props) {
  const {size, teamname, username, isTeam: _isTeam} = p
  const isTeam = _isTeam || !!teamname
  const name = isTeam ? teamname : username
  const counter = AvatarZus.useAvatarState(s => s.counts.get(name || '') ?? 0)
  const httpSrv = useConfigState(s => s.httpSrv)
  const isDarkMode = useColorScheme() === 'dark'
  const {address, token} = httpSrv

  const cached = styleCache.get(`${size}-${isTeam}`)!

  let source: {uri: string} | null = null
  if (address && name) {
    const typ = isTeam ? 'team' : 'user'
    const mode = isDarkMode ? 'dark' : 'light'
    const imgSize = size <= 64 ? 192 : size <= 96 ? 256 : 960
    source = {
      uri: `http://${address}/av?typ=${typ}&name=${name}&format=square_${imgSize}&mode=${mode}&token=${token}&count=${counter}`,
    }
  }

  return (
    <View style={cached.container}>
      {source ? <Image source={source} style={cached.image} /> : null}
    </View>
  )
}

export default Avatar2
