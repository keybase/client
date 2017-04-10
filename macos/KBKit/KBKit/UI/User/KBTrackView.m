//
//  KBTrackView.m
//  Keybase
//
//  Created by Gabriel on 1/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTrackView.h"

#import "KBDefines.h"
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

  YOHBox *buttons = [YOHBox box:@{@"spacing": @(10), @"horizontalAlignment": @"center"}];
  buttons.ignoreLayoutForHidden = YES;
  [self addSubview:buttons];

  GHWeakSelf gself = self;
  _trackButton = [KBButton buttonWithText:@"Track" style:KBButtonStylePrimary];
  _trackButton.targetBlock = ^{ gself.completion(YES); };
  [buttons addSubview:_trackButton];

  _untrackButton = [KBButton buttonWithText:@"Remove Tracking" style:KBButtonStyleDanger];
  [buttons addSubview:_untrackButton];

  _cancelButton = [KBButton button];
  _cancelButton.targetBlock = ^{ gself.completion(NO); };
  [buttons addSubview:_cancelButton];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.label].size.height + 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 40) view:buttons].size.height + 20;
    return CGSizeMake(size.width, y);
  }];

  _trackButton.hidden = YES;
  _cancelButton.hidden = YES;
  _untrackButton.hidden = YES;
}

- (void)clear {
  _trackButton.hidden = YES;
  _cancelButton.hidden = YES;
  _untrackButton.hidden = YES;
  _trackStatus = nil;
  _completion = nil;
  [self setNeedsLayout];
}

- (void)enableTracking:(NSString *)label color:(NSColor *)color update:(BOOL)update {
  [_label setMarkup:label font:KBAppearance.currentAppearance.textFont color:color alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  if (update) {
    [_trackButton setText:@"Yes, Update" style:KBButtonStylePrimary options:0];
  } else {
    [_trackButton setText:@"Yes, Track" style:KBButtonStylePrimary options:0];
  }
  _trackButton.hidden = NO;
  [self setNeedsLayout];
}

- (void)setTrackStatus:(KBUserTrackStatus *)trackStatus skippable:(BOOL)skippable completion:(KBTrackCompletion)completion {
  [self clear];
  _trackStatus = trackStatus;
  _completion = completion;

  NSString *cancelText = @"Close";
  switch (_trackStatus.status) {
    case KBTrackStatusNone: {
      [self enableTracking:NSStringWithFormat(@"<strong>Publicly track \"%@\"?</strong>", _trackStatus.username) color:KBAppearance.currentAppearance.textColor update:NO];
      cancelText = @"No, Skip";
      break;
    }
    case KBTrackStatusValid: {
      [_label setMarkup:@"Your tracking statement of is up to date." font:KBAppearance.currentAppearance.textFont color:KBAppearance.currentAppearance.successColor alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
      _untrackButton.hidden = NO;
      cancelText = @"Close";
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
      [_label setMarkup:@"We found an account but we don't have anything to track, since they haven't proven their identity." font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance warnColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
      cancelText = @"Close";
      break;
    }
    case KBTrackStatusFail: {
      [_label setMarkup:@"Oops, some proofs failed." font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance warnColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
      cancelText = @"Close";
      break;
    }
  }

  _cancelButton.hidden = !skippable;
  [_cancelButton setText:cancelText style:KBButtonStyleDefault options:0];
  [self setNeedsLayout];
}

- (void)setTrackAction:(KBTrackAction)trackAction error:(NSError *)error {
  switch (trackAction) {
    case KBTrackActionErrored: {
      DDLogError(@"Error tracking: %@", error);
      [_label setMarkup:NSStringWithFormat(@"There was an error tracking %@. (%@)", _trackStatus.username, error.localizedDescription) font:[NSFont systemFontOfSize:14] color:KBAppearance.currentAppearance.dangerColor alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
      break;
    }
    case KBTrackActionTracked: {
      [_label setMarkup:NSStringWithFormat(@"Success! You are now tracking %@.", _trackStatus.username) font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance successColor] alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
      break;
    }
    case KBTrackActionUntracked: {
      [_label setMarkup:@"OK, we removed the tracking." font:[NSFont systemFontOfSize:14] color:KBAppearance.currentAppearance.successColor alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
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
