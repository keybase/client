//
//  KBUserKeyView.m
//  Keybase
//
//  Created by Gabriel on 7/9/15.
//  Copyright (c) 2017 Keybase. All rights reserved.
//

#import "KBUserKeyView.h"

#import "KBHeaderLabelView.h"
#import "KBFormatter.h"
#import "KBNotifications.h"
#import "KBPGPTextView.h"
#import "KBDefines.h"

#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBUserKeyView ()
@property YOVBox *labels;
@property (nonatomic) KBRIdentifyKey *identifyKey;
@end

@implementation KBUserKeyView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  YOVBox *contentView = [YOVBox box];
  {
    _labels = [YOVBox box:@{@"insets": @(20), @"spacing": @(4)}];
    [contentView addSubview:_labels];
    [contentView addSubview:[KBBox horizontalLine]];

    YOHBox *buttons = [YOHBox box:@{@"insets": @"15", @"spacing": @(10), @"minSize": @"90,0"}];
    [buttons kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];
    {
      YOHBox *rightButtons = [YOHBox box:@{@"spacing": @(10), @"horizontalAlignment": @"right", @"minSize": @"90,0"}];
      _closeButton = [KBButton buttonWithText:@"Close" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
      [rightButtons addSubview:_closeButton];
      [buttons addSubview:rightButtons];
    }
    [contentView addSubview:buttons];

  }
  [self addSubview:contentView];

  self.viewLayout = [YOVBorderLayout fitVertical:contentView];
}

- (void)setIdentifyKey:(KBRIdentifyKey *)identifyKey {
  _identifyKey = identifyKey;

  [_labels kb_removeAllSubviews];

  if (_identifyKey.pgpFingerprint) {
    NSString *description = KBDescriptionForFingerprint(KBHexString(_identifyKey.pgpFingerprint, @""), 20);
    [self addText:description header:@"PGP Fingerprint"];
  }

  [self setNeedsLayout];
}

- (void)close {
  [_closeButton dispatchButton];
}

- (void)addText:(NSString *)text header:(NSString *)header {
  KBHeaderLabelView *label = [[KBHeaderLabelView alloc] init];
  label.columnWidth = 140;
  label.labelPaddingTop = 2;
  [label setHeader:header];
  if (_identifyKey.pgpFingerprint) [label addText:text style:KBTextStyleDefault options:KBTextOptionsMonospace lineBreakMode:NSLineBreakByWordWrapping targetBlock:nil];
  [_labels addSubview:label];
  [self setNeedsLayout];
}

@end

