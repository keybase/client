//
//  KBTrackView.h
//  Keybase
//
//  Created by Gabriel on 1/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBRPC.h"

typedef void (^KBTrackResponseBlock)(KBRFinishAndPromptRes *response); // Response nil on cancel

@interface KBTrackView : YOView

- (void)clear;

- (BOOL)setUser:(KBRUser *)user popup:(BOOL)popup identifyOutcome:(KBRIdentifyOutcome *)identifyOutcome trackResponse:(KBTrackResponseBlock)trackResponse;

- (BOOL)setTrackCompleted:(NSError *)error;

@end
