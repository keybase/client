//
//  ActionViewController.m
//  Action
//
//  Created by Gabriel on 6/9/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "ActionViewController.h"
#import "KBPGPEncryptActionView.h"
#import "KBService.h"
#import "KBWorkspace.h"
#import "KBLogFormatter.h"

@interface ActionViewController ()
@end

@implementation ActionViewController

- (NSString *)nibName {
  return @"ActionViewController";
}

- (void)loadView {
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    DDTTYLogger.sharedInstance.logFormatter = [[KBLogFormatter alloc] init];
    [DDLog addLogger:DDTTYLogger.sharedInstance withLevel:DDLogLevelDebug]; // Xcode output
  });

  KBPGPEncryptActionView *encryptView = [[KBPGPEncryptActionView alloc] init];
  [encryptView sizeToFit];
  self.view = encryptView;

  NSExtensionItem *item = self.extensionContext.inputItems.firstObject;
  encryptView.extensionItem = item;

  KBEnvConfig *config = [KBEnvConfig env:KBEnvSandbox];
  KBService *service = [[KBService alloc] initWithConfig:config];
  encryptView.client = service.client;

  encryptView.completion = ^(id sender, NSExtensionItem *item) {
    if (!item) {
      [self cancel];
    } else {
      [self share:item];
    }
  };

  DDLogDebug(@"Attachments: %@", item.attachments);
}

- (void)share:(NSExtensionItem *)outputItem {
  [self.extensionContext completeRequestReturningItems:@[outputItem] completionHandler:nil];
}

- (void)cancel {
  NSError *cancelError = [NSError errorWithDomain:NSCocoaErrorDomain code:NSUserCancelledError userInfo:nil];
  [self.extensionContext cancelRequestWithError:cancelError];
}

@end


