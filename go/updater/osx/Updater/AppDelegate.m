//
//  AppDelegate.m
//  Updater
//
//  Created by Gabriel on 4/7/16.
//  Copyright © 2016 Keybase. All rights reserved.
//

#import "AppDelegate.h"

#import "Defines.h"
#import "Prompt.h"

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  // Check if test environment
  if ([self isRunningTests]) return;

  // Run as accessory (no dock or menu).
  // The update prompt window will still be modal but won't take focus away from
  // other apps when it pops up.
  [NSApp setActivationPolicy:NSApplicationActivationPolicyAccessory];

  dispatch_async(dispatch_get_main_queue(), ^{
    [self run];
  });
}

- (void)run {
  NSString *inputString = @"{}";

  NSArray *args = NSProcessInfo.processInfo.arguments;
  if (args.count > 0) {
    NSArray *subargs = [args subarrayWithRange:NSMakeRange(1, args.count-1)];
    if (subargs.count >= 1) {
      inputString = subargs[0];
    }
  }

  [Prompt showPromptWithInputString:inputString presenter:^NSModalResponse(NSAlert *alert) {
    return [alert runModal];
  } completion:^(NSData *output) {
    if (!!output) {
      [[NSFileHandle fileHandleWithStandardOutput] writeData:output];
    }
    fflush(stdout);
    fflush(stderr);
    exit(0);
  }];
}

- (BOOL)isRunningTests {
  // The Xcode test environment is a little awkward. Instead of using TEST preprocessor macro, check env.
  NSDictionary *environment = [[NSProcessInfo processInfo] environment];
  NSString *testFilePath = environment[@"XCTestConfigurationFilePath"];
  return !!testFilePath;
}

@end
