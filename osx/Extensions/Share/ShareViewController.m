//
//  ShareViewController.m
//  Share
//
//  Created by Gabriel on 6/7/15.
//  Copyright (c) 2017 Keybase. All rights reserved.
//

#import "ShareViewController.h"

#import <KBKit/KBAppExtension.h>

#define KBExtLog NSLog

@interface ShareViewController ()
@property KBAppExtension *app;
@end

@implementation ShareViewController

- (void)didSelectPost {
  NSExtensionItem *item = self.extensionContext.inputItems.firstObject;
  KBExtLog(@"Attachments: %@", item.attachments);

  _app = [[KBAppExtension alloc] init];
  [_app encryptExtensionItem:item usernames:@[] sender:self.view completion:^(id sender, NSExtensionItem *outputItem) {
    if (outputItem) [self.extensionContext completeRequestReturningItems:@[outputItem] completionHandler:nil];
  }];
}

@end

