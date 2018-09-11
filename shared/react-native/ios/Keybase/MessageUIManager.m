//
//  MessageUIManager.m
//  Keybase
//
//  Created by Daniel Ayoub on 11/8/17.
//  Copyright © 2017 Keybase. All rights reserved.
//

#import "MessageUIManager.h"
#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <MessageUI/MessageUI.h>

@implementation MessageUIManager

#pragma mark - RCTBridgeModule

RCT_EXPORT_MODULE(MessageUI);

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (NSDictionary *)constantsToExport
{
  return @{ @"MESSAGE_CANCELLED": @0, @"MESSAGE_SENT": @1, @"MESSAGE_FAILED": @2 };
}

RCT_EXPORT_METHOD(composeMessage:(NSArray *)recipients body:(NSString *)body composeMessageWithResolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  
  MFMessageComposeViewController *mcvc = [[MFMessageComposeViewController alloc] init];
  
  if (!MFMessageComposeViewController.canSendText)
  {
    reject(@"unsupported", @"Cannot open messages view", nil); // TODO
    return;
  }
  
  mcvc.messageComposeDelegate = self;
  
  self.resolve = resolve;
  
  mcvc.recipients = recipients;
  mcvc.body = body;
  
  UIViewController *root = [[[[UIApplication sharedApplication] delegate] window] rootViewController];
  dispatch_async(dispatch_get_main_queue(), ^{
    [root presentViewController:mcvc animated:YES completion:NULL];
  });
}

#pragma mark - MFMessageComposeViewControllerDelegate

- (void)messageComposeViewController:(MFMessageComposeViewController *)controller didFinishWithResult:(MessageComposeResult)result
{
  NSNumber * res = [NSNumber numberWithInt:result];
  self.resolve(res);
  [controller dismissViewControllerAnimated:YES completion:NULL];
}

@end
