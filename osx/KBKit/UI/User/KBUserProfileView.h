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
#import "KBContentView.h"

@interface KBUserProfileView : KBContentView

@property (weak) KBWindow *popupWindow;
@property (readonly, getter=isLoading) BOOL loading;

- (BOOL)isLoadingUsername:(NSString *)username;

- (void)setUsername:(NSString *)username client:(KBRPClient *)client;

- (void)refresh;

- (void)clear;

- (void)registerClient:(KBRPClient *)client sessionId:(NSInteger)sessionId sender:(id)sender;

- (void)openPopupWindow:(KBWindow *)parentWindow;

@end


// Handles concurrent user viewing (swaps in a new user view if existing view is loading)
@interface KBUserProfileViewer : YOView

- (void)setUsername:(NSString *)username client:(KBRPClient *)client;

- (void)clear;

@end