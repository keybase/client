//
//  KBUserProfileView.h
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBRPC.h"
#import "KBTrackView.h"
#import "KBContentView.h"

@interface KBUserProfileView : KBContentView

@property (getter=isPopup) BOOL popup;

- (void)setUsername:(NSString *)username editable:(BOOL)editable;

- (void)clear;

- (void)registerClient:(KBRPClient *)client sessionId:(NSInteger)sessionId sender:(id)sender;

@end
