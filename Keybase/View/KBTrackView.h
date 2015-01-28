//
//  KBTrackView.h
//  Keybase
//
//  Created by Gabriel on 1/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBUIDefines.h"
#import "KBRPC.h"

typedef void (^KBTrackResponseBlock)(KBRFinishAndPromptRes *response);

@interface KBTrackView : YONSView

- (void)clear;

- (BOOL)setUser:(KBRUser *)user identifyOutcome:(KBRIdentifyOutcome *)identifyOutcome trackResponse:(KBTrackResponseBlock)trackResponse;

- (void)setTrackCompleted:(NSError *)error;

@end
