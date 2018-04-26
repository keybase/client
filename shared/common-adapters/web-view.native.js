// @flow
import {isIOS} from '../constants/platform'
import {WebView} from 'react-native'
import WKWebView from 'react-native-wkwebview-reborn'

const wv = isIOS ? WKWebView : WebView

export default wv
