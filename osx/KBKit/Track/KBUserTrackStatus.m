//
//  KBTrackStatus.m
//  Keybase
//
//  Created by Gabriel on 6/17/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBUserTrackStatus.h"

@interface KBUserTrackStatus ()
@property NSString *username;
@property KBTrackStatus status;
@end

@implementation KBUserTrackStatus

- (instancetype)initWithUsername:(NSString *)username identifyOutcome:(KBRIdentifyOutcome *)identifyOutcome {
  if ((self = [super init])) {
    _username = username;
    [self setIdentifyOutcome:identifyOutcome];
  }
  return self;
}

- (void)setIdentifyOutcome:(KBRIdentifyOutcome *)identifyOutcome {
  //
  // Track failure (numTrackFailures) is if there was an irreconcilable error
  // between the new state and the state that was previously tracked.
  // Proof failure (numProofFailures) is if there was a remote twitter proof
  // (or githb proof) that failed to verify (network or server failure).
  //

  BOOL tracked = !!identifyOutcome.trackUsed;
  //BOOL isRemote = tracked ? identifyOutcome.trackUsed.isRemote : NO;

  if (identifyOutcome.numTrackFailures > 0 || identifyOutcome.numRevoked > 0) {
    _status = KBTrackStatusBroken;
  } else if (identifyOutcome.numTrackChanges > 0) {
    _status = KBTrackStatusNeedsUpdate;
  } else if (identifyOutcome.numProofSuccesses == 0) {
    _status = KBTrackStatusUntrackable;
  } else if (tracked && identifyOutcome.numTrackChanges == 0) {
    _status = KBTrackStatusValid;
  } else if (identifyOutcome.numProofFailures > 0) {
    _status = KBTrackStatusFail;
  } else {
    _status = KBTrackStatusNone;
  }
}

@end
