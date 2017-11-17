//
//  MessageUIManager.h
//  Keybase
//
//  Created by Daniel Ayoub on 11/9/17.
//  Copyright © 2017 Keybase. All rights reserved.
//


#import <Foundation/Foundation.h>
#import <React/RCTBridgeModule.h>
#import <MessageUI/MessageUI.h>

#ifndef MessageUIManager_h
#define MessageUIManager_h

@interface MessageUIManager : NSObject <RCTBridgeModule, MFMessageComposeViewControllerDelegate>

@property (nonatomic) RCTPromiseResolveBlock resolve;

@end

#endif /* MessageUIManager_h */
