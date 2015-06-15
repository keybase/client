//
//  ShareViewController.m
//  Share
//
//  Created by Gabriel on 6/7/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "ShareViewController.h"

#import <KBKit/KBAppActions.h>

@interface ShareViewController ()
@end

@implementation ShareViewController

- (NSString *)nibName {
  return @"ShareViewController";
}

- (void)loadView {
  NSExtensionItem *item = self.extensionContext.inputItems.firstObject;
  DDLogDebug(@"Attachments: %@", item.attachments);
  id view = [KBAppActions encryptWithExtensionItem:item completion:^(id sender, NSExtensionItem *outputItem) {
    if (!outputItem) {
      [self cancel];
    } else {
      [self share:outputItem];
    }
  }];

  self.view = view;
}

- (void)share:(NSExtensionItem *)outputItem {
  [self.extensionContext completeRequestReturningItems:@[outputItem] completionHandler:nil];
}

- (void)cancel {
  NSError *cancelError = [NSError errorWithDomain:NSCocoaErrorDomain code:NSUserCancelledError userInfo:nil];
  [self.extensionContext cancelRequestWithError:cancelError];
}

@end

