//
//  ShareViewController.m
//  Share
//
//  Created by Gabriel on 6/7/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "ShareViewController.h"

@interface ShareViewController ()
@end

@implementation ShareViewController

- (NSString *)nibName {
  return @"ShareViewController";
}

- (void)loadView {
  [super loadView];

}

- (void)share:(NSExtensionItem *)outputItem {
  [self.extensionContext completeRequestReturningItems:@[outputItem] completionHandler:nil];
}

- (void)cancel {
  NSError *cancelError = [NSError errorWithDomain:NSCocoaErrorDomain code:NSUserCancelledError userInfo:nil];
  [self.extensionContext cancelRequestWithError:cancelError];
}

@end

