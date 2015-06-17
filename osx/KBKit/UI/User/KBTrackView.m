//
//  KBTrackView.m
//  Keybase
//
//  Created by Gabriel on 1/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTrackView.h"

#import "KBUserTrackStatus.h"

@interface KBTrackView ()
@property KBLabel *label;
@property KBButton *trackButton;
@property KBButton *untrackButton;
@property KBButton *cancelButton;

@property KBUserTrackStatus *trackStatus;
@property (copy) KBTrackCompletion completion;
@end

@implementation KBTrackView

- (void)viewInit {
  [super viewInit];

  _label = [[KBLabel alloc] init];
  [self addSubview:_label];

  GHWeakSelf gself = self;
  _trackButton = [KBButton buttonWithText:@"Track" style:KBButtonStylePrimary];
  _trackButton.targetBlock = ^{ gself.completion(YES); };
  [self addSubview:_trackButton];

  _untrackButton = [KBButton buttonWithText:@"Remove Tracking" style:KBButtonStyleDefault];
  [self addSubview:_untrackButton];

  _cancelButton = [KBButton button];
  _cancelButton.targetBlock = ^{ gself.completion(NO); };
  [self addSubview:_cancelButton];

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
    if (!yself.cancelButton.hidden) {
      [layout sizeToFitVerticalInFrame:CGRectMake(270, y, 100, 0) view:yself.cancelButton];
    }

    y += 60;

    return CGSizeMake(size.width, y);
  }];

  [self clear];
}

- (void)clear {
  _trackButton.hidden = YES;
  _cancelButton.hidden = YES;
  _untrackButton.hidden = YES;
  _trackStatus = nil;
  _completion = nil;
}

- (void)enableTracking:(NSString *)label color:(NSColor *)color update:(BOOL)update {
  [_label setMarkup:label font:[NSFont systemFontOfSize:14] color:color alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  if (update) {
    [_trackButton setText:@"Yes, Update" style:KBButtonStylePrimary alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  } else {
    [_trackButton setText:@"Yes, Track" style:KBButtonStylePrimary alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  }
  _trackButton.hidden = NO;
}

- (void)setTrackStatus:(KBUserTrackStatus *)trackStatus skipable:(BOOL)skipable completion:(KBTrackCompletion)completion {
  [self clear];
  _trackStatus = trackStatus;
  _completion = completion;

  NSString *cancelText = @"Cancel";
  switch (_trackStatus.status) {
    case KBTrackStatusNone: {
      [self enableTracking:NSStringWithFormat(@"<strong>Publicly track \"%@\"?</strong>", _trackStatus.username) color:KBAppearance.currentAppearance.textColor update:NO];
      cancelText = @"No, Skip";
      break;
    }
    case KBTrackStatusValid: {
      [_label setMarkup:NSStringWithFormat(@"Your tracking statement of %@ is up to date.", _trackStatus.username) font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance successColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
      _untrackButton.hidden = NO;
      break;
    }
    case KBTrackStatusBroken: {
      [self enableTracking:@"Oops, your tracking statement is broken. Fix it?" color:KBAppearance.currentAppearance.warnColor update:YES];
      cancelText = @"No, Skip";
      break;
    }
    case KBTrackStatusNeedsUpdate: {
      [self enableTracking:@"<strong>Do you want to update your tracking statement?</strong>" color:KBAppearance.currentAppearance.textColor update:
       YES];
      cancelText = @"No, Skip";
      break;
    }
    case KBTrackStatusUntrackable: {
      [_label setMarkup:@"We found an account, but they haven't proven their identity." font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance warnColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
      cancelText = @"OK";
      break;
    }
    case KBTrackStatusFail: {
      [_label setMarkup:@"Oops, some proofs failed." font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance warnColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
      cancelText = @"OK";
      break;
    }
  }

  _cancelButton.hidden = !skipable;
  [_cancelButton setText:cancelText style:KBButtonStyleDefault options:0];
}

- (void)setTrackAction:(KBTrackAction)trackAction error:(NSError *)error {
  switch (trackAction) {
    case KBTrackActionError: {
      DDLogError(@"Error tracking: %@", error);
      [_label setMarkup:NSStringWithFormat(@"There was an error tracking %@. (%@)", _trackStatus.username, error.localizedDescription) font:[NSFont systemFontOfSize:14] color:KBAppearance.currentAppearance.dangerColor alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
      break;
    }
    case KBTrackActionSuccess: {
      [_label setMarkup:NSStringWithFormat(@"Success! You are now tracking %@.", _trackStatus.username) font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance successColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
      break;
    }
    case KBTrackActionSkipped: {
      [_label setMarkup:NSStringWithFormat(@"Ok, we skipped tracking %@.", _trackStatus.username) font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance successColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
      break;
    }
    case KBTrackActionNone: break;
  }
  [self setNeedsLayout];
}

@end
