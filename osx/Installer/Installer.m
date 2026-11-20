//
//  Installer.m
//  Keybase
//
//  Created by Gabriel on 11/23/15.
//  Copyright © 2015 Keybase. All rights reserved.
//

#import "Installer.h"

#import <KBKit/KBKit.h>
#import "Options.h"
#import "Uninstaller.h"

@interface Installer ()
@property Options *options;
@end

typedef NS_ENUM (NSInteger, KBExit) {
  KBExitOK = 0,
  KBExitError = 1,
  KBExitFuseKextError = 4,
  KBExitFuseKextPermissionError = 5,
  KBExitAuthCanceledError = 6,
  KBExitFuseKextMountsPresentError = 7,
  KBExitFuseCriticalUpdate = 8,
};

@implementation Installer

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  dispatch_async(dispatch_get_main_queue(), ^{
    [self run];
  });
}

- (void)run {
  // Check process arguments directly for debug (instead of GBCli) to setup logging right away
  NSArray *arguments = [[NSProcessInfo processInfo] arguments];
  BOOL debug = NO;
  if ([arguments containsObject:@"--debug"]) {
    debug = YES;
  }
#if DEBUG
  debug = YES;
#endif

  [KBWorkspace setupLogging:debug];

  DDLogDebug(@"Version: %@", NSBundle.mainBundle.infoDictionary[(NSString *)kCFBundleVersionKey]);

  GBSettings *settings = [GBSettings settingsWithName:@"Settings" parent:nil];
#if DEBUG
  [settings setObject:@"/Applications/Keybase.app" forKey:@"app-path"];
  [settings setObject:@"prod" forKey:@"run-mode"];
  [settings setObject:@"10" forKey:@"timeout"];
#endif
  _options = [[Options alloc] initWithSettings:settings];
  NSError *parseError = nil;
  if (![_options parseArgs:&parseError]) {
    DDLogError(@"Error parsing: %@", parseError);
    [self exit:KBExitError];
    return;
  }

  if ([_options isUninstall]) {
    [self uninstall];
  } else {
    [self install];
  }
}

- (void)waitForLog {
  dispatch_semaphore_t sema = dispatch_semaphore_create(0);
  dispatch_async(DDLog.loggingQueue, ^{
    dispatch_semaphore_signal(sema);
  });
  dispatch_semaphore_wait(sema, dispatch_time(DISPATCH_TIME_NOW, 1.0 * NSEC_PER_SEC));
}

- (void)exit:(KBExit)code {
  [self waitForLog];
  exit(code);
}

- (void)install {
  KBEnvironment *environment = [self.options environment];
  KBInstaller *installer = [[KBInstaller alloc] init];
  [installer installWithEnvironment:environment completion:^(NSError *error) {
    KBExit exitCode = [self exitCodeForError:error];
    dispatch_async(dispatch_get_main_queue(), ^{
      DDLogInfo(@"Exit(%@)", @(exitCode));
      [self exit:exitCode];
    });
  }];
}

- (void)uninstall {
  [Uninstaller uninstallWithOptions:_options completion:^(NSError *error) {
    if (error) {
      DDLogError(@"Error uninstalling: %@", error);
      [self exit:KBExitError];
      return;
    }
    DDLogInfo(@"Uninstalled");
    [self exit:KBExitOK];
  }];
}

- (IBAction)quit:(id)sender {
  [NSApplication.sharedApplication terminate:sender];
}

- (KBExit)exitCodeForError:(NSError *)error {
  if (!error) return KBExitOK;
  switch (error.code) {
    case KBErrorCodeFuseKextPermission: return KBExitFuseKextPermissionError;
    case KBErrorCodeFuseKext: return KBExitFuseKextError;
    case errAuthorizationCanceled: return KBExitAuthCanceledError;
    case KBErrorCodeFuseKextMountsPresent: return KBExitFuseKextMountsPresentError;
    case KBErrorCodeFuseCriticalUpdate: return KBExitFuseCriticalUpdate;
    default: return KBExitError;
  }
}

@end
