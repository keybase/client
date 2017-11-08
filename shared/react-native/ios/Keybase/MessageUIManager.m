//
//  MessageUIManager.m
//  Keybase
//
//  Created by Daniel Ayoub on 11/8/17.
//  Copyright © 2017 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <MessageUI/MessageUI.h>

@interface MessageUIManager : NSObject <RCTBridgeModule, MFMessageComposeViewControllerDelegate>

@end

@implementation MessageUIManager



RCT_EXPORT_MODULE('NativeMessageUI');

RCT_EXPORT_METHOD(composeMessage:(NSArray *)recipients body:(NSString *)body callback:(RCTResponseSenderBlock)callback)
{
  MFMessageComposeViewController *mcvc = [[MFMessageComposeViewController alloc] init];
  mcvc.messageComposeDelegate = self;
  
  mcvc.recipients = recipients;
  mcvc.body = body;
  
}

#pragma mark - MFMessageComposeViewControllerDelegate

@end
