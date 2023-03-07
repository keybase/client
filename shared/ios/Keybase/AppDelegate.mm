//
//  AppDelegate.m
//  Keybase
//
//  Created by Chris Nojima on 9/28/16.
//  Copyright © 2016 Keybase. All rights reserved.
//
#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import "AppDelegate+KB.h"

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
  [self didLaunchSetupBefore:application];
  
  self.moduleName = @"Keybase";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};
  
  [super application:application didFinishLaunchingWithOptions:launchOptions];
  UIView * rootView = self.window.rootViewController.view;
  [self addDrop:rootView];
  [self didLaunchSetupAfter: rootView];
  return YES;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  [[RCTBundleURLProvider sharedSettings] setEnableDev: true];
 // uncomment to get a prod bundle.
 //   [[RCTBundleURLProvider sharedSettings] setEnableDev: false];
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

/// This method controls whether the `concurrentRoot`feature of React18 is turned on or off.
///
/// @see: https://reactjs.org/blog/2022/03/29/react-v18.html
/// @note: This requires to be rendering on Fabric (i.e. on the New Architecture).
/// @return: `true` if the `concurrentRoot` feature is enabled. Otherwise, it returns `false`.
- (BOOL)concurrentRootEnabled {
  // Switch this bool to turn on and off the concurrent root
  return true;
}

- (BOOL)turboModuleEnabled
{
  return NO;
}

- (BOOL)fabricEnabled
{
  return NO;
}

@end
