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
//@property NSPopUpButton *trackOptionsView;
@property KBButton *button;
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

//  _trackOptionsView = [[NSPopUpButton alloc] init];
//  _trackOptionsView.font = [NSFont systemFontOfSize:14];
//  _trackOptionsView.focusRingType = NSFocusRingTypeNone;
//  [self addSubview:_trackOptionsView];

  GHWeakSelf gself = self;
  _button = [KBButton buttonWithText:@"Track" style:KBButtonStylePrimary];
//  _button.targetBlock = ^{
//    gself.trackOptions = nil;
//    if (gself.trackOptionsView.indexOfSelectedItem == 0) {
//      // Track (remote)
//      gself.trackOptions = [[KBRFinishAndPromptRes alloc] init];
//      gself.trackOptions.trackRemote = YES;
//      gself.trackResponse(gself.trackOptions);
//    } else if (gself.trackOptionsView.indexOfSelectedItem == 1) {
//      // Nothing (don't track)
//      gself.trackResponse(nil);
//    }
//  };
  _button.targetBlock = ^{
    gself.trackOptions = [[KBRFinishAndPromptRes alloc] init];
    gself.trackOptions.trackRemote = YES;
    gself.trackResponse(gself.trackOptions);
  };
  [self addSubview:_button];
  _button.hidden = YES;

  _skipButton = [KBButton buttonWithText:@"No, Skip" style:KBButtonStyleDefault];
  _skipButton.targetBlock = ^{
    gself.trackResponse([[KBRFinishAndPromptRes alloc] init]);
  };
  [self addSubview:_skipButton];
  _skipButton.hidden = YES;

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.label].size.height + 10;

//    if (!yself.trackOptionsView.hidden) {
//      y += [layout setFrame:CGRectMake(40, y, size.width - 80, 24) view:yself.trackOptionsView].size.height + 10;
//    }

    if (!yself.button.hidden) {
      [layout sizeToFitVerticalInFrame:CGRectMake(50, y, 200, 0) view:yself.button];
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
  //[_trackOptionsView removeAllItems];
  _trackResponse = nil;
}

- (void)enableTracking:(NSString *)label color:(NSColor *)color popup:(BOOL)popup update:(BOOL)update {
  [_label setMarkup:label font:[NSFont systemFontOfSize:14] color:color alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  if (update) {
//    _trackOptionsView.hidden = NO;
//    [_trackOptionsView addItemWithTitle:NSStringWithFormat(@"retrack %@ with updated info", _user.username)];
//    [_trackOptionsView addItemWithTitle:@"no, don't update"];
//    [_trackOptionsView selectItemAtIndex:0];
    [_button setText:@"Yes, Update" style:KBButtonStylePrimary alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  } else {
//    _trackOptionsView.hidden = NO;
//    [_trackOptionsView addItemWithTitle:NSStringWithFormat(@"yes, track %@", _user.username)];
//    [_trackOptionsView addItemWithTitle:NSStringWithFormat(@"no, don't track %@", _user.username)];
//    [_trackOptionsView selectItemAtIndex:0];
    [_button setText:@"Yes, Track" style:KBButtonStylePrimary alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  }

  _skipButton.hidden = !popup;
  _button.hidden = NO;
}

- (BOOL)setUsername:(NSString *)username popup:(BOOL)popup identifyOutcome:(KBRIdentifyOutcome *)identifyOutcome trackResponse:(KBTrackResponseBlock)trackResponse {
  _username = username;
  _trackResponse = trackResponse;

//  [_trackOptionsView removeAllItems];
//  _trackOptionsView.hidden = YES;
  _button.hidden = YES;
  _skipButton.hidden = YES;

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
    [_label setMarkup:@"We found an account, but they haven't proven their identity." font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance warnColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  } else if (tracked && identifyOutcome.numTrackChanges == 0) {
    // Your tracking statement is up-to-date
    //NSDate *trackDate =  [NSDate gh_parseTimeSinceEpoch:@(identifyOutcome.trackUsed.time) withDefault:nil];
    [_label setMarkup:NSStringWithFormat(@"Your tracking statement of %@ is up to date.", _username) font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance okColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  } else if (identifyOutcome.numProofFailures > 0) {
    // Some proofs failed
    [_label setMarkup:@"Oops, some proofs failed." font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance warnColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  } else {
    //[self enableTracking:NSStringWithFormat(@"<strong>Publicly track \"%@\"?</strong> <em>This is recommended.</em>", _user.username) color:[KBAppearance.currentAppearance textColor] update:NO];
    [self enableTracking:NSStringWithFormat(@"<strong>Publicly track \"%@\"?</strong>", _username) color:[KBAppearance.currentAppearance textColor] popup:popup update:NO];
    _trackPrompt = YES;
  }

  return _trackPrompt;
}

- (BOOL)setTrackCompleted:(NSError *)error {
  if (!_trackPrompt) return NO;

  if (error) {
    [_label setMarkup:NSStringWithFormat(@"There was an error tracking %@. (%@)", _username, error.localizedDescription) font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance errorColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  } else if (!_trackOptions) {
    [_label setMarkup:NSStringWithFormat(@"Ok, we skipped tracking %@.", _username) font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance okColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  } else {
    [_label setMarkup:NSStringWithFormat(@"Success! You are now tracking %@.", _username) font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance okColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  }
  //_trackOptionsView.hidden = YES;
  _button.hidden = YES;
//  _skipButton.hidden = YES;
  [self setNeedsLayout];
  return YES;
}

@end
