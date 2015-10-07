dep:
	npm install

dep-ios: dep
	cd ios; pod install
	npm run gobuild-ios
	npm run reactbundle-ios

dep-android: dep
	npm run gobuild-android
	react-native run-android
