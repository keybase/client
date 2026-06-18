/* global module */

// Native-only React Native packages with no desktop equivalent.
// Used in two places:
//   1. ignored-modules.js → webpack aliases them to null-module.js
//   2. jest.config.js → Jest stubs them with test/mocks/native-module.js
//
// When a merged .tsx file adds a new native-only package in an isMobile branch, add it here.
module.exports = [
  '@legendapp/list/keyboard',
  'lottie-react-native',
  'expo-audio',
  'expo-location',
  'expo-video',
  '@gorhom/bottom-sheet',
  'react-native-keyboard-controller',
  'react-native-screens',
  'react-native-safe-area-context',
  'expo-modules-core',
  'react-native-kb',
  'react-native-reanimated',
  'react-native-worklets',
  'expo',
  'expo-video',
  'expo-image-picker',
  '@react-native-picker/picker',
  'expo-clipboard',
  'expo-image',
  'expo-contacts',
  'expo-localization',
  'expo-media-library',
  'expo-file-system',
  '@callstack/liquid-glass',
  'react-native-screens/experimental',
  '@react-navigation/bottom-tabs',
  'react-native-gesture-handler',
]
