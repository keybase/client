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
@property KBMemLogger *memLogger;
@end

typedef NS_ENUM (NSInteger, KBExit) {
  KBExitOK = 0,
  KBExitIgnoreError = 0,
  KBExitError = 1,
};

@implementation Installer

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
  dispatch_async(dispatch_get_main_queue(), ^{
    [self run];
  });
}

- (void)run {
  [KBWorkspace setupLogging];

  _memLogger = [[KBMemLogger alloc] init];
  [DDLog addLogger:_memLogger withLevel:DDLogLevelDebug];

  [KBAppearance setCurrentAppearance:[KBUIAppearance appearance]];

  DDLogDebug(@"Version: %@", NSBundle.mainBundle.infoDictionary[(NSString *)kCFBundleVersionKey]);

  GBSettings *settings = [GBSettings settingsWithName:@"Settings" parent:nil];
#if DEBUG
  [settings setObject:@"/Applications/Keybase.app" forKey:@"app-path"];
  //  [self.settings setObject:@"/Volumes/Keybase/Keybase.app" forKey:@"app-path"];
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
  [self install:^(NSError *error, KBEnvironment *environment, KBExit exitCode) {
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

+ (instancetype)sharedDelegate {
  return (Installer *)[NSApp delegate];
}

- (IBAction)quit:(id)sender {
  [NSApplication.sharedApplication terminate:sender];
}

- (void)install:(void (^)(NSError *error, KBEnvironment *environment, KBExit exit))completion {
  KBEnvironment *environment = [self.options environment];

  KBInstaller *installer = [[KBInstaller alloc] init];
  [installer installWithEnvironment:environment force:NO stopOnError:YES completion:^(NSError *error, NSArray *installables) {
    [self checkError:error environment:environment completion:^(NSError *error, KBExit exit) {
      completion(error, environment, exit);
    }];
  }];
}

- (void)checkError:(NSError *)error environment:(KBEnvironment *)environment completion:(void (^)(NSError *error, KBExit exit))completion {
  if (!error) {
    completion(nil, KBExitOK);
    return;
  }

  // Helper auth canceled, denied or not allowed
  if ([error.domain isEqualToString:@"keybase.Helper"] &&
      (error.code == errAuthorizationCanceled || error.code == errAuthorizationDenied || error.code == errAuthorizationInteractionNotAllowed)) {
    NSString *title = @"Keybase: Installation Required";
    NSString *message = [NSString stringWithFormat:@"We were unable to install a helper tool needed for Keybase to work properly (%@).", @(error.code)];
    [self showQuitDialogWithTitle:title message:message error:error environment:environment completion:completion];
  } else {
    [self showErrorDialog:error environment:environment completion:completion];
  }
}

- (void)showQuitDialogWithTitle:(NSString *)title message:(NSString *)message error:(NSError *)error environment:(KBEnvironment *)environment completion:(void (^)(NSError *error, KBExit exit))completion {
  NSAlert *alert = [[NSAlert alloc] init];
  [alert setMessageText:title];
  [alert setInformativeText:message];
  [alert addButtonWithTitle:@"Quit"];

  [alert setAlertStyle:NSWarningAlertStyle];
  NSModalResponse response = [alert runModal];
  if (response == NSAlertFirstButtonReturn) {
    completion(error, KBExitError);
  } else {
    DDLogError(@"Unknown error dialog return button");
    completion(error, KBExitError);
  }
}

- (void)showErrorDialog:(NSError *)error environment:(KBEnvironment *)environment completion:(void (^)(NSError *error, KBExit exit))completion {
  NSAlert *alert = [[NSAlert alloc] init];
  [alert setMessageText:@"Keybase Error"];
  [alert setInformativeText:error.localizedDescription];
  [alert addButtonWithTitle:@"Quit"];
  [alert addButtonWithTitle:@"Ignore"];
  [alert addButtonWithTitle:@"More Details"];

  [alert setAlertStyle:NSWarningAlertStyle];
  NSModalResponse response = [alert runModal];
  if (response == NSAlertFirstButtonReturn) {
    completion(error, KBExitError);
  } else if (response == NSAlertSecondButtonReturn) {
    completion(error, KBExitIgnoreError);
  } else if (response == NSAlertThirdButtonReturn) {
    [self showMoreDetails:error environment:environment completion:completion];
  } else {
    DDLogError(@"Unknown error dialog return button");
    completion(error, KBExitError);
  }
}

- (void)showMoreDetails:(NSError *)error environment:(KBEnvironment *)environment completion:(void (^)(NSError *error, KBExit exit))completion {
  NSAlert *alert = [[NSAlert alloc] init];
  [alert setMessageText:@"Keybase Error"];
  [alert setInformativeText:error.localizedDescription];
  [alert addButtonWithTitle:@"Quit"];
  [alert addButtonWithTitle:@"Ignore"];

  KBTextView *textView = [[KBTextView alloc] init];
  textView.editable = NO;
  textView.view.textContainerInset = CGSizeMake(5, 5);

  NSMutableString *info = [NSMutableString stringWithString:[environment debugInstallables]];
  if (_memLogger) {
    [info appendString:@"Log:\n"];
    [info appendString:[_memLogger messages]];
  }
  [textView setText:info style:KBTextStyleDefault options:KBTextOptionsMonospace|KBTextOptionsSmall alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByCharWrapping];

  textView.frame = CGRectMake(0, 0, 500, 200);
  textView.borderType = NSBezelBorder;
  alert.accessoryView = textView;

  NSModalResponse response = [alert runModal];
  if (response == NSAlertFirstButtonReturn) {
    completion(error, KBExitError);
  } else if (response == NSAlertSecondButtonReturn) {
    completion(error, KBExitIgnoreError);
  }
}

@end
