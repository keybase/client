//
//  KBWorkspace.m
//  Keybase
//
//  Created by Gabriel on 6/8/15.
//  Copyright (c) 2017 Keybase. All rights reserved.
//

#import "KBWorkspace.h"

#import "KBAlert.h"
#import "KBLogFormatter.h"
#import "KBDefines.h"
#import "KBFormatter.h"

#import <ObjectiveSugar/ObjectiveSugar.h>
#import <CocoaLumberjack/CocoaLumberjack.h>
#import <Tikppa/Tikppa.h>

@implementation KBWorkspace

// The workspace user defaults uses the shared App Group container, so
// extensions and the app can share preferences.
+ (NSUserDefaults *)userDefaults {
  static NSUserDefaults *userDefaults;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    userDefaults = [[NSUserDefaults alloc] initWithSuiteName:KBAppGroupId];
  });
  return userDefaults;
}

+ (void)setupLogging:(BOOL)debug {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    DDTTYLogger.sharedInstance.logFormatter = [[KBLogFormatter alloc] init];
    [DDLog addLogger:DDTTYLogger.sharedInstance withLevel:debug ? DDLogLevelDebug : DDLogLevelInfo]; // Xcode output
  });
}

+ (NSString *)applicationSupport:(NSArray *)subdirs create:(BOOL)create error:(NSError **)error {
  NSString *directory = [NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, YES) firstObject];
  if (!directory) {
    if (error) *error = KBMakeError(KBErrorCodePathNotFound, @"No application support directory");
    return nil;
  }
  directory = [directory stringByAppendingPathComponent:@"Keybase"];
  if (subdirs) {
    for (NSString *subdir in subdirs) {
      directory = [directory stringByAppendingPathComponent:subdir];
    }
  }

  if (create && ![NSFileManager.defaultManager fileExistsAtPath:directory]) {
    [NSFileManager.defaultManager createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:nil error:error];
    if (error) {
      return nil;
    }
  }
  return directory;
}

+ (void)openURLString:(NSString *)URLString prompt:(BOOL)prompt sender:(id)sender {
  if (!prompt) {
    [NSWorkspace.sharedWorkspace openURL:[NSURL URLWithString:URLString]];
  } else {
    [KBAlert yesNoWithTitle:@"Open a Link" description:NSStringWithFormat(@"Do you want to open %@?", URLString) yes:@"Open" view:sender completion:^(BOOL yes) {
      if (yes) [NSWorkspace.sharedWorkspace openURL:[NSURL URLWithString:URLString]];
    }];
  }
}

+ (NSWindow *)windowWithContentView:(NSView<NSWindowDelegate> *)contentView {
  NSWindow *window = [[NSWindow alloc] init];
  window.styleMask = NSClosableWindowMask | NSFullSizeContentViewWindowMask | NSTitledWindowMask;
  window.hasShadow = YES;
  window.titleVisibility = NSWindowTitleHidden;
  window.titlebarAppearsTransparent = YES;
  window.movableByWindowBackground = YES;
  window.delegate = contentView;
  [window setContentView:contentView];
  return window;
}

+ (NSWindow *)createMainWindow:(NSView<NSWindowDelegate> *)view {
  KBWindow *window = [KBWindow windowWithContentView:view size:CGSizeMake(800, 600) retain:YES];
  window.minSize = CGSizeMake(600, 600);
  //window.maxSize = CGSizeMake(600, 900);
  window.delegate = view; // Overrides default delegate
  window.titleVisibility = NO;
  window.styleMask = NSClosableWindowMask | NSFullSizeContentViewWindowMask | NSTitledWindowMask | NSResizableWindowMask | NSMiniaturizableWindowMask;

  window.backgroundColor = KBAppearance.currentAppearance.secondaryBackgroundColor;
  //window.restorable = YES;
  //window.restorationClass = self.class;
  //window.navigation.titleView = [KBTitleView titleViewWithTitle:@"Keybase" navigation:window.navigation];
  //[window setLevel:NSStatusWindowLevel];
  return window;
}

@end


