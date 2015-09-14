//  Keybase
//
//  Created by Chris Nojima on 8/25/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "AppDelegate.h"

#import "RCTRootView.h"

// Set this to 1 to use the application bundle to hold the react JS
#define REACT_EMBEDDED_BUNDLE 0


@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
    NSURL *jsCodeLocation;

#if (REACT_EMBEDDED_BUNDLE)
  // http://facebook.github.io/react-native/docs/runningondevice.html
  jsCodeLocation = [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#else
  #ifdef REACT_HOST_HARDCODED
    #define REACT_HOST @"192.168.1.50:8081"
  #else
    #define REACT_HOST @"localhost:8081"
  #endif

  jsCodeLocation = [NSURL URLWithString:[NSString stringWithFormat:@"http://%@/react/index.ios.bundle", REACT_HOST]];

  // sanity check if you're running on device
  #if !(TARGET_IPHONE_SIMULATOR)
#warning "You're testing dynamic react on your device. DON'T deploy a build like this"
  #endif
#endif

  RCTRootView *rootView = [[RCTRootView alloc] initWithBundleURL:jsCodeLocation
                                                      moduleName:@"Keybase"
                                                   launchOptions:launchOptions];

  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  UIViewController *rootViewController = [[UIViewController alloc] init];
  rootViewController.view = rootView;
  self.window.rootViewController = rootViewController;
  [self.window makeKeyAndVisible];
  return YES;
}

@end
