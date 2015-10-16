source ~/.bash_profile # load go paths
cd $SRCROOT/..
npm run reactbundle-ios # build bundle
npm run gobuild-ios # build go library
