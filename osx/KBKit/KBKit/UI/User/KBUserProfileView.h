//
//  KBUserProfileView.h
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>


#import "KBRPC.h"
#import "KBTrackView.h"
#import <Tikppa/Tikppa.h>
#import "KBRPC.h"

@interface KBUserProfileView : YOView

@property KBNavigationView *navigation;
@property KBRPClient *client;

@property (readonly, getter=isLoading) BOOL loading;

@property BOOL popup;
@property (weak) NSWindow *fromWindow;

- (BOOL)isLoadingUsername:(NSString *)username;

- (void)setUsername:(NSString *)username client:(KBRPClient *)client;

- (void)refresh;

- (void)clear;

- (void)registerClient:(KBRPClient *)client sessionId:(NSNumber *)sessionId;

- (void)openPopupWindow;

@end


// Handles concurrent user viewing (swaps in a new user view if existing view is loading)
@interface KBUserProfileViewer : YOView

- (void)setUsername:(NSString *)username client:(KBRPClient *)client;

- (void)clear;

@end