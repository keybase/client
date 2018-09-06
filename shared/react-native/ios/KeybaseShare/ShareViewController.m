//
//  ShareViewController.m
//  KeybaseShare
//
//  Created by Michael Maxim on 8/31/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#import "ShareViewController.h"
#import "keybase/keybase.h"

@interface ShareViewController ()
@property NSDictionary* convTarget;
@end

@implementation ShareViewController

- (BOOL)isContentValid {
    // Do validation of contentText and/or NSExtensionContext attachments here
    return YES;
}

- (NSItemProvider*)getFirstSendableAttachment:(NSArray*)attachments {
  NSItemProvider* item = nil;
  for (NSItemProvider* a in attachments) {
    if ([a hasItemConformingToTypeIdentifier:@"public.url"] && ![a hasItemConformingToTypeIdentifier:@"public.file-url"]) {
      item = a;
      break;
    }
  }
  if(!item) {
    for (NSItemProvider* a in attachments) {
      if ([a hasItemConformingToTypeIdentifier:@"public.image"]) {
        item = a;
        break;
      }
    }
  }
  if(!item) {
    item = attachments.firstObject;
  }
  return item;
}

- (void)didSelectPost {
  if (!self.convTarget) {
    [self.extensionContext completeRequestReturningItems:@[] completionHandler:nil];
    return;
  }
  
  NSExtensionItem *input = self.extensionContext.inputItems.firstObject;
  NSItemProvider* item = [self getFirstSendableAttachment:[input attachments]];
  
  NSItemProviderCompletionHandler urlHandler = ^(NSURL* url, NSError* error) {
    NSString* body = (self.contentText.length) ? [NSString stringWithFormat:@"%@ %@", self.contentText, url.absoluteString] : url.absoluteString;
    KeybaseExtensionPostURL(self.convTarget[@"ConvID"], self.convTarget[@"Name"], NO, body, &error);
    [[NSOperationQueue mainQueue] addOperationWithBlock:^{
      [self.extensionContext completeRequestReturningItems:nil completionHandler:nil];
    }];
  };
  
  if([item hasItemConformingToTypeIdentifier:@"public.url"]) {
    [item loadItemForTypeIdentifier:@"public.url" options:nil completionHandler:urlHandler];
  } else {
    [self.extensionContext completeRequestReturningItems:@[] completionHandler:nil];
  }
}

- (NSArray *)configurationItems {
  SLComposeSheetConfigurationItem *item = [[SLComposeSheetConfigurationItem alloc] init];
  item.title = @"Share to...";
  if (self.convTarget) {
    item.value = self.convTarget[@"Name"];
  } else {
    item.value = @"Please choose";
  }
  item.tapHandler = ^{
    ConversationViewController *viewController = [[ConversationViewController alloc] initWithStyle:UITableViewStylePlain];
    viewController.delegate = self;
    [self pushConfigurationViewController:viewController];
  };
  return @[item];
}

- (void)convSelected:(NSDictionary *)conv {
  [self setConvTarget:conv];
  [self reloadConfigurationItems];
  [self popConfigurationViewController];
}

@end
