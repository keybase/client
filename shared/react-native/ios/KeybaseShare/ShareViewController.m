//
//  ShareViewController.m
//  KeybaseShare
//
//  Created by Michael Maxim on 8/31/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#import "ShareViewController.h"
#import "ConversationViewController.h"
#import "keybase/keybase.h"

@interface ShareViewController ()

@end

@implementation ShareViewController

- (BOOL)isContentValid {
    // Do validation of contentText and/or NSExtensionContext attachments here
    return YES;
}

- (void)didSelectPost {
    // This is called after the user selects Post. Do the upload of contentText and/or NSExtensionContext attachments.
  NSString* contentText = [self contentText];
  NSExtensionItem *input = self.extensionContext.inputItems.firstObject;
  NSArray* items = [input attachments];
  for (NSItemProvider* item in items) {
    if ([item hasItemConformingToTypeIdentifier:@"public.url"]) {
      NSLog(@"url");
    }
  }
    // Inform the host that we're done, so it un-blocks its UI. Note: Alternatively you could call super's -didSelectPost, which will similarly complete the extension context.
    [self.extensionContext completeRequestReturningItems:@[] completionHandler:nil];
}

- (NSArray *)configurationItems {
  SLComposeSheetConfigurationItem *item = [[SLComposeSheetConfigurationItem alloc] init];
  item.title = @"Share to...";
  item.value = @"Please choose";
  item.tapHandler = ^{
    ConversationViewController *viewController = [[ConversationViewController alloc] initWithStyle:UITableViewStylePlain];
    [self pushConfigurationViewController:viewController];
  };
  return @[item];
}

@end
