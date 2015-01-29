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
@property NSPopUpButton *trackOptionsView;
@property KBButton *button;

@property KBRUser *user;
@property (copy) KBTrackResponseBlock trackResponse;

@property BOOL trackPrompt; // Whether we prompted to track
@property KBRFinishAndPromptRes *trackOptions; // What options we used to track (could be nil, if track was skipped)
@end

@implementation KBTrackView

- (void)viewInit {
  [super viewInit];

  _label = [[KBLabel alloc] init];
  [self addSubview:_label];

  _trackOptionsView = [[NSPopUpButton alloc] init];
  _trackOptionsView.font = [NSFont systemFontOfSize:14];
  _trackOptionsView.focusRingType = NSFocusRingTypeNone;
  [self addSubview:_trackOptionsView];

  GHWeakSelf gself = self;
  _button = [KBButton buttonWithText:@"Done"];
  _button.targetBlock = ^{
    gself.trackOptions = nil;
    if (gself.trackOptionsView.indexOfSelectedItem == 0) {
      // Track remote
      gself.trackOptions = [[KBRFinishAndPromptRes alloc] init];
      gself.trackOptions.trackRemote = YES;
      gself.trackResponse(gself.trackOptions);
    } else if (gself.trackOptionsView.indexOfSelectedItem == 1) {
      // Nothing (don't track)
      gself.trackResponse(nil);
    }
  };
  [self addSubview:_button];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 40) view:yself.label].size.height + 10;

    y += [layout setFrame:CGRectMake(40, y, size.width - 80, 24) view:yself.trackOptionsView].size.height + 10;

    y += [layout setFrame:CGRectMake(40, y, 100, KBDefaultButtonHeight) view:yself.button].size.height + 10;
    return CGSizeMake(size.width, y);
  }];

  [self clear];
}

- (void)clear {
  [_trackOptionsView removeAllItems];
  _trackResponse = nil;
}

- (void)enableTracking:(BOOL)update {
  if (update) {
    [_label setMarkup:@"<strong>How would you like to proceed?</strong>" font:[NSFont systemFontOfSize:14] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

    _trackOptionsView.hidden = NO;
    [_trackOptionsView addItemWithTitle:NSStringWithFormat(@"retrack with new info %@", _user.username)];
    [_trackOptionsView addItemWithTitle:@"no, don't update"];
    [_trackOptionsView selectItemAtIndex:0];
  } else {
    [_label setMarkup:NSStringWithFormat(@"<strong>Publicly track \"%@\"?</strong> <em>This is recommended.</em>", _user.username) font:[NSFont systemFontOfSize:14] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

    _trackOptionsView.hidden = NO;
    [_trackOptionsView addItemWithTitle:NSStringWithFormat(@"yes, track %@", _user.username)];
    [_trackOptionsView addItemWithTitle:NSStringWithFormat(@"no, don't track %@", _user.username)];
    [_trackOptionsView selectItemAtIndex:0];
  }

  _button.hidden = NO;
}

- (BOOL)setUser:(KBRUser *)user identifyOutcome:(KBRIdentifyOutcome *)identifyOutcome trackResponse:(KBTrackResponseBlock)trackResponse {
  _user = user;
  _trackResponse = trackResponse;

  [_trackOptionsView removeAllItems];
  _trackOptionsView.hidden = YES;
  _button.hidden = YES;

  _trackPrompt = NO;

  BOOL tracked = !!identifyOutcome.trackUsed;
  //BOOL isRemote = tracked ? identifyOutcome.trackUsed.isRemote : NO;

  if (identifyOutcome.numTrackFailures > 0 || identifyOutcome.numDeleted > 0) {
    // Your tracking statement of _ is broken; fix it?
    [_label setMarkup:@"Oops, your tracking statement is broken." font:[NSFont systemFontOfSize:14] color:[KBLookAndFeel warnColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  } else if (identifyOutcome.numTrackChanges > 0) {
    // Your tracking statement of _ is still valid; update it to reflect new proofs?"
    [self enableTracking:YES];
    _trackPrompt = YES;
  } else if (identifyOutcome.numProofSuccesses == 0) {
    // We found an account for _, but they haven't proven their identity.
    [_label setMarkup:@"We found an account, but they haven't proven their identity." font:[NSFont systemFontOfSize:14] color:[KBLookAndFeel warnColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  } else if (tracked && identifyOutcome.numTrackChanges == 0) {
    // Your tracking statement is up-to-date
    //NSDate *trackDate =  [NSDate gh_parseTimeSinceEpoch:@(identifyOutcome.trackUsed.time) withDefault:nil];
    [_label setMarkup:NSStringWithFormat(@"Your tracking statement of %@ is up to date.", _user.username) font:[NSFont systemFontOfSize:14] color:[KBLookAndFeel okColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  } else if (identifyOutcome.numProofFailures > 0) {
    // Some proofs failed
    [_label setMarkup:@"Oops, some proofs failed." font:[NSFont systemFontOfSize:14] color:[KBLookAndFeel warnColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  } else {
    [self enableTracking:NO];
    _trackPrompt = YES;
  }

  return _trackPrompt;
}

- (BOOL)setTrackCompleted:(NSError *)error {
  if (!_trackPrompt) return NO;

  if (error) {
    [_label setMarkup:NSStringWithFormat(@"There was an error tracking %@. (%@)", _user.username, error.localizedDescription) font:[NSFont systemFontOfSize:14] color:[KBLookAndFeel errorColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  } else if (!_trackOptions) {
    [_label setMarkup:NSStringWithFormat(@"Ok, we skipped tracking %@.", _user.username) font:[NSFont systemFontOfSize:14] color:[KBLookAndFeel okColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  } else {
    [_label setMarkup:NSStringWithFormat(@"Success! You are now tracking %@.", _user.username) font:[NSFont systemFontOfSize:14] color:[KBLookAndFeel okColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  }
  _trackOptionsView.hidden = YES;
  _button.hidden = YES;
  [self setNeedsLayout];
  return YES;
}

@end
