//
//  KBPaperKeyDisplayView.m
//  Keybase
//
//  Created by Gabriel on 8/19/15.
//  Copyright (c) 2015 Keybase. All rights reserved.
//

#import "KBPaperKeyDisplayView.h"

#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBPaperKeyDisplayView ()
@property KBLabel *label;
@property KBLabel *phraseLabel;
@end

@implementation KBPaperKeyDisplayView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  YOView *contentView = [[YOView alloc] init];
  [self addSubview:contentView];

  KBLabel *header = [[KBLabel alloc] init];
  [header setText:@"Paper Key" style:KBTextStyleHeaderLarge alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [contentView addSubview:header];

  _label = [[KBLabel alloc] init];
  [contentView addSubview:_label];

  _phraseLabel = [[KBLabel alloc] init];
  _phraseLabel.selectable = YES;
  [_phraseLabel kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];
  [_phraseLabel setBorderEnabled:YES];
  _phraseLabel.insets = UIEdgeInsetsMake(10, 20, 10, 20);
  [contentView addSubview:_phraseLabel];

  YOHBox *footerView = [YOHBox box:@{@"spacing": @(20), @"minSize": @"130,0", @"horizontalAlignment": @"center"}];
  _button = [KBButton buttonWithText:@"OK" style:KBButtonStylePrimary];
  [footerView addSubview:_button];

  [contentView addSubview:footerView];

  YOSelf yself = self;
  contentView.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;

    y += [layout centerWithSize:CGSizeMake(400, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:header].size.height + 20;

    y += [layout centerWithSize:CGSizeMake(400, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.label].size.height + 30;

    y += [layout centerWithSize:CGSizeMake(500, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.phraseLabel].size.height + 40;

    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:footerView].size.height;

    return CGSizeMake(MIN(580, size.width), y);
  }];

  self.viewLayout = [YOLayout center:contentView];
}

- (void)viewDidAppear:(BOOL)animated {
  [self.window recalculateKeyViewLoop];
  [self.window makeFirstResponder:_phraseLabel.textView];
}

- (void)setPhrase:(NSString *)phrase {
  [_label setMarkup:@"You should write down this phrase somewhere on a piece of paper as a backup." style:KBTextStyleDefault alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  [_phraseLabel setText:phrase font:[NSFont fontWithName:@"Monaco" size:20] color:KBAppearance.currentAppearance.textColor alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  [self setNeedsLayout];
}

+ (void)registerDisplay:(KBRPClient *)client sessionId:(NSNumber *)sessionId navigation:(KBNavigationView *)navigation {
  [client registerMethod:@"keybase.1.loginUi.displayPrimaryPaperKey" sessionId:sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRDisplayPrimaryPaperKeyRequestParams *requestParams = [[KBRDisplayPrimaryPaperKeyRequestParams alloc] initWithParams:params];
    KBPaperKeyDisplayView *view = [[KBPaperKeyDisplayView alloc] init];
    [view setPhrase:requestParams.phrase];
    view.button.targetBlock = ^{
      completion(nil, @YES);
    };
    [navigation pushView:view animated:YES];
  }];
}

@end

