import {Linking} from 'react-native'

export default function openURL (url) {
  Linking.openURL(url).catch(err => console.warn('An error occurred', err))
}

