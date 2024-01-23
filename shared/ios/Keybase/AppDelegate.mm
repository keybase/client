//
//  AppDelegate.m
//  Keybase
//
//  Created by Chris Nojima on 9/28/16.
//  Copyright © 2016 Keybase. All rights reserved.
//
#import "AppDelegate.h"

#import "AppDelegate+KB.h"
#import <React/RCTBundleURLProvider.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application
    didFinishLaunchingWithOptions:(NSDictionary *)launchOptions {
  [self didLaunchSetupBefore:application];

  self.moduleName = @"Keybase";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  [super application:application didFinishLaunchingWithOptions:launchOptions];
  UIView *rootView = self.window.rootViewController.view;
  [self addDrop:rootView];
  [self didLaunchSetupAfter:rootView];
  return YES;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge {
  return [self getBundleURL];
}

- (NSURL *)getBundleURL {
#if DEBUG
  [[RCTBundleURLProvider sharedSettings] setEnableDev:true];
  // uncomment to get a prod bundle.
  //   [[RCTBundleURLProvider sharedSettings] setEnableDev: false];
  return
      [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main"
                                 withExtension:@"jsbundle"];
#endif
}

@end
