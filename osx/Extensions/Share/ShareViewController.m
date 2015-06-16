//
//  ShareViewController.m
//  Share
//
//  Created by Gabriel on 6/7/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "ShareViewController.h"

#import <KBKit/KBAppExtensions.h>

#define KBLog NSLog

@interface ShareViewController ()
@property KBAppExtensions *app;
@end

@implementation ShareViewController

- (void)didSelectPost {
  NSExtensionItem *item = self.extensionContext.inputItems.firstObject;
  KBLog(@"Attachments: %@", item.attachments);

  _app = [[KBAppExtensions alloc] init];
  [_app encryptExtensionItem:item usernames:@[] sender:self.view completion:^(id sender, NSExtensionItem *outputItem) {
    if (outputItem) [self.extensionContext completeRequestReturningItems:@[outputItem] completionHandler:nil];
  }];
}

@end

