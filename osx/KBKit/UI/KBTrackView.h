//
//  KBTrackView.h
//  Keybase
//
//  Created by Gabriel on 1/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBAppKit/KBAppKit.h>
#import "KBRPC.h"

typedef void (^KBTrackResponseBlock)(NSString *username);

@interface KBTrackView : YOView

@property (readonly) KBButton *untrackButton;

- (void)clear;

- (BOOL)setUsername:(NSString *)username popup:(BOOL)popup identifyOutcome:(KBRIdentifyOutcome *)identifyOutcome trackResponse:(KBTrackResponseBlock)trackResponse;

- (BOOL)setTrackCompleted:(NSError *)error;

@end
