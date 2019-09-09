// import Electron from 'electron'
import punycode from 'punycode'

const target = typeof window === 'undefined' ? global : window

target.KB = {
  punycode, // used by a dep
}
