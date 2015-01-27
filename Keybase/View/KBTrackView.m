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
@end

@implementation KBTrackView

- (void)viewInit {
  [super viewInit];

  _label = [[KBLabel alloc] init];
  [self addSubview:_label];

  _trackOptionsView = [[NSPopUpButton alloc] init];
  _trackOptionsView.font = [NSFont systemFontOfSize:16];
  _trackOptionsView.focusRingType = NSFocusRingTypeNone;
  [self addSubview:_trackOptionsView];

  GHWeakSelf gself = self;
  _button = [KBButton buttonWithText:@"Done"];
  _button.targetBlock = ^{
    if (gself.trackOptionsView.indexOfSelectedItem == 0) {
      [gself track:YES];
    } else if (gself.trackOptionsView.indexOfSelectedItem == 0) {
      [gself track:NO];
    } else {
      // Nothing
    }

  };
  [self addSubview:_button];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 40) view:yself.label].size.height + 10;

    y += [layout setFrame:CGRectMake(40, y, 200, 24) view:yself.trackOptionsView].size.height + 10;

    y += [layout setFrame:CGRectMake(40, y, 100, KBDefaultButtonHeight) view:yself.button].size.height + 10;
    return CGSizeMake(size.width, y);
  }];
}

- (void)track:(BOOL)remote {
  KBTODO(self);
//  KBRTrackRequest *track = [[KBRTrackRequest alloc] init];
//  [track trackWithTheirName:_identify.user.username completion:^(NSError *error) {
//    // TODO
//  }];
}

- (void)setIdentify:(KBRIdentifyRes *)identify {
  _identify = identify;
  [_trackOptionsView removeAllItems];

  if (!identify) {
    self.hidden = YES;
    return;
  }
  self.hidden = NO;

  KBRIdentifyOutcome *identifyOutcome = identify.outcome;
  BOOL tracked = !!identifyOutcome.trackUsed;
  //BOOL isRemote = tracked ? identifyOutcome.trackUsed.isRemote : NO;

  if (identifyOutcome.numTrackFailures > 0 || identifyOutcome.numDeleted > 0) {
    // Your tracking statement of _ is broken; fix it?
  } else if (identifyOutcome.numTrackChanges > 0) {
    // Your tracking statement of _ is still valid; update it to reflect new proofs?"
  } else if (identifyOutcome.numProofSuccesses == 0) {
    // We found an account for _, but they haven't proven their identity.
  } else if (tracked && identifyOutcome.numTrackChanges == 0) {
    // Your tracking statement is up-to-date
  } else if (identifyOutcome.numProofFailures > 0) {
    // Some proofs failed
    //[_warnings setText:@"Some proofs failed!" font:[NSFont systemFontOfSize:16] color:[KBLookAndFeel errorColor] alignment:NSLeftTextAlignment];
  } else {
    [_label setMarkup:NSStringWithFormat(@"<strong>Publicly track \"%@\"?</strong> <em>This is recommended.</em>", identify.user.username) font:[NSFont systemFontOfSize:16] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

    [_trackOptionsView addItemWithTitle:NSStringWithFormat(@"yes, track %@", identify.user.username)];
    [_trackOptionsView addItemWithTitle:NSStringWithFormat(@"track %@ privately", identify.user.username)];
    [_trackOptionsView addItemWithTitle:NSStringWithFormat(@"no, don't track %@", identify.user.username)];
    [_trackOptionsView selectItemAtIndex:0];
  }
}



@end
