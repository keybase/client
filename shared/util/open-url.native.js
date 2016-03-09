import {Linking} from 'react-native'

export default function openURL (url) {
  Linking.openURL(url).catch(err => console.error('An error occurred', err))
}

