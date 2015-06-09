//
//  ShareViewController.m
//  Share
//
//  Created by Gabriel on 6/7/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "ShareViewController.h"
#import "KBPGPEncryptShareView.h"
#import "KBService.h"
#import "KBWorkspace.h"

@interface ShareViewController ()
@end

@implementation ShareViewController

- (NSString *)nibName {
  return @"ShareViewController";
}

- (void)loadView {
  [super loadView];

  KBPGPEncryptShareView *encryptView = [[KBPGPEncryptShareView alloc] init];
  [encryptView sizeToFit];
  self.view = encryptView;

  NSExtensionItem *item = self.extensionContext.inputItems.firstObject;
  encryptView.extensionItem = item;

  KBEnvConfig *config = [KBEnvConfig loadFromUserDefaults:[KBWorkspace userDefaults]];
  if (!config) {
    // TODO No config means they haven't run or installed the app
  }
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

