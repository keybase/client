//
//  KBUserTrackStatus.h
//  Keybase
//
//  Created by Gabriel on 6/17/15.
//  Copyright (c) 2017 Keybase. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBRPC.h"

typedef NS_ENUM (NSInteger, KBTrackStatus) {
  KBTrackStatusNone, // Not tracking
  KBTrackStatusValid, // Valid and up to date
  KBTrackStatusBroken, // Proof failures or deletions
  KBTrackStatusNeedsUpdate, // New proofs
  KBTrackStatusUntrackable, // Nothing to track
  KBTrackStatusFail, // Proofs failed
};

typedef NS_ENUM (NSInteger, KBTrackAction) {
  KBTrackActionNone,
  KBTrackActionSkipped,
  KBTrackActionTracked,
  KBTrackActionUntracked,
  KBTrackActionErrored,
};

@interface KBUserTrackStatus : NSObject

@property (readonly) NSString *username;
@property (readonly) KBTrackStatus status;

- (instancetype)initWithUsername:(NSString *)username identifyOutcome:(KBRIdentifyOutcome *)identifyOutcome;

@end
