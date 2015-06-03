//
//  KBTrackView.m
//  Keybase
//
//  Created by Gabriel on 1/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTrackView.h"

@interface KBTrackView ()
@property KBLabel *label;
@property KBButton *trackButton;
@property KBButton *untrackButton;
@property KBButton *skipButton;

@property NSString *username;
@property (copy) KBTrackResponseBlock trackResponse;

@property BOOL trackPrompt; // Whether we prompted to track
@property KBRFinishAndPromptRes *trackOptions; // What options we used to track (could be nil, if track was skipped)
@end

@implementation KBTrackView

- (void)viewInit {
  [super viewInit];

  _label = [[KBLabel alloc] init];
  [self addSubview:_label];

  GHWeakSelf gself = self;
  _trackButton = [KBButton buttonWithText:@"Track" style:KBButtonStylePrimary];
  _trackButton.targetBlock = ^{
    gself.trackResponse(gself.username);
  };
  [self addSubview:_trackButton];
  _trackButton.hidden = YES;

  _untrackButton = [KBButton buttonWithText:@"Remove Tracking" style:KBButtonStyleDefault];
  [self addSubview:_untrackButton];
  _untrackButton.hidden = YES;

  _skipButton = [KBButton buttonWithText:@"No, Skip" style:KBButtonStyleDefault];
  _skipButton.targetBlock = ^{
    gself.trackResponse(nil);
  };
  [self addSubview:_skipButton];
  _skipButton.hidden = YES;

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.label].size.height + 10;

    if (!yself.trackButton.hidden) {
      [layout sizeToFitVerticalInFrame:CGRectMake(50, y, 200, 0) view:yself.trackButton];
    }
    if (!yself.untrackButton.hidden) {
      [layout sizeToFitVerticalInFrame:CGRectMake(50, y, 200, 0) view:yself.untrackButton];
    }

    if (!yself.skipButton.hidden) {
      [layout sizeToFitVerticalInFrame:CGRectMake(270, y, 100, 0) view:yself.skipButton];
    }

    y += 60;

    return CGSizeMake(size.width, y);
  }];

  [self clear];
}

- (void)clear {
  _trackResponse = nil;
}

- (void)enableTracking:(NSString *)label color:(NSColor *)color popup:(BOOL)popup update:(BOOL)update {
  [_label setMarkup:label font:[NSFont systemFontOfSize:14] color:color alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  if (update) {
    [_trackButton setText:@"Yes, Update" style:KBButtonStylePrimary alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  } else {
    [_trackButton setText:@"Yes, Track" style:KBButtonStylePrimary alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  }

  _skipButton.hidden = !popup;
  _trackButton.hidden = NO;
}

- (BOOL)setUsername:(NSString *)username popup:(BOOL)popup identifyOutcome:(KBRIdentifyOutcome *)identifyOutcome trackResponse:(KBTrackResponseBlock)trackResponse {
  _username = username;
  _trackResponse = trackResponse;

  _trackButton.hidden = YES;
  _skipButton.hidden = YES;
  _untrackButton.hidden = YES;

  _trackPrompt = NO;

  /*
   Track failure is if there was an irreconcilable error between the new state and the state that was previously tracked.
   Proof failure is if there was a remote twitter proof (or githb proof) that failed to verify (network or server failure).
   */

  BOOL tracked = !!identifyOutcome.trackUsed;
  //BOOL isRemote = tracked ? identifyOutcome.trackUsed.isRemote : NO;

  if (identifyOutcome.numTrackFailures > 0 || identifyOutcome.numDeleted > 0) {
    // Your tracking statement of _ is broken; fix it?
    // TODO This label is confusing?
    [self enableTracking:@"Oops, your tracking statement is broken. Fix it?" color:[KBAppearance.currentAppearance warnColor] popup:popup update:YES];
    _trackPrompt = YES;
  } else if (identifyOutcome.numTrackChanges > 0) {
    // Your tracking statement of _ is still valid; update it to reflect new proofs?"
    [self enableTracking:@"<strong>Do you want to update your tracking statement?</strong>" color:[KBAppearance.currentAppearance textColor] popup:popup update:YES];
    _trackPrompt = YES;
  } else if (identifyOutcome.numProofSuccesses == 0) {
    // We found an account for _, but they haven't proven their identity.
    [_label setMarkup:@"We found an account, but they haven't proven their identity." font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance warnColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  } else if (tracked && identifyOutcome.numTrackChanges == 0) {
    // Your tracking statement is up-to-date
    //NSDate *trackDate =  [NSDate gh_parseTimeSinceEpoch:@(identifyOutcome.trackUsed.time) withDefault:nil];
    [_label setMarkup:NSStringWithFormat(@"Your tracking statement of %@ is up to date.", _username) font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance okColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
    _untrackButton.hidden = NO;
  } else if (identifyOutcome.numProofFailures > 0) {
    // Some proofs failed
    [_label setMarkup:@"Oops, some proofs failed." font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance warnColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  } else {
    // Publicly track {username}? This is recommended.
    [self enableTracking:NSStringWithFormat(@"<strong>Publicly track \"%@\"?</strong>", _username) color:[KBAppearance.currentAppearance textColor] popup:popup update:NO];
    _trackPrompt = YES;
  }

  return _trackPrompt;
}

- (BOOL)setTrackCompleted:(NSError *)error {
  if (!_trackPrompt) return NO;

  if (error) {
    DDLogError(@"Error tracking: %@", error);
    [_label setMarkup:NSStringWithFormat(@"There was an error tracking %@. (%@)", _username, error.localizedDescription) font:[NSFont systemFontOfSize:14] color:KBAppearance.currentAppearance.dangerColor alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  } else if (!_trackOptions) {
    [_label setMarkup:NSStringWithFormat(@"Ok, we skipped tracking %@.", _username) font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance okColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  } else {
    [_label setMarkup:NSStringWithFormat(@"Success! You are now tracking %@.", _username) font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance okColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  }
  //_trackButton.hidden = YES;
  [self setNeedsLayout];
  return YES;
}

@end
