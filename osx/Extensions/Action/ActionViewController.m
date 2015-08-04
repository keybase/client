//
//  ActionViewController.m
//  Action
//
//  Created by Gabriel on 6/9/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "ActionViewController.h"

#import <KBKit/KBAppExtension.h>

#define KBExtLog NSLog

@interface ActionViewController ()
@property KBAppExtension *app;
@end

@implementation ActionViewController

- (NSString *)nibName {
  return @"ActionViewController";
}

- (void)loadView {
  NSExtensionItem *item = self.extensionContext.inputItems.firstObject;
  KBExtLog(@"Attachments: %@", item.attachments);
  _app = [[KBAppExtension alloc] init];
  id view = [_app encryptViewWithExtensionItem:item completion:^(id sender, NSExtensionItem *outputItem) {
    if (!outputItem) {
      [self cancel];
    } else {
      [self performAction:outputItem];
    }
  }];

  [view sizeToFit];
  self.view = view;
}

- (void)performAction:(NSExtensionItem *)outputItem {
  [self.extensionContext completeRequestReturningItems:@[outputItem] completionHandler:nil];
}

- (void)cancel {
  NSError *cancelError = [NSError errorWithDomain:NSCocoaErrorDomain code:NSUserCancelledError userInfo:nil];
  [self.extensionContext cancelRequestWithError:cancelError];
}

@end


