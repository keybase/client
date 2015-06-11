//
//  KBAlertView.m
//  Keybase
//
//  Created by Gabriel on 6/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBAlertView.h"

@interface KBAlertView ()
@property KBLabel *header;
@property KBLabel *label;
@property YOVBox *buttonsView;
@end

@implementation KBAlertView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  YOVBox *contentView = [YOVBox box:@{@"insets": @"10,80,10,80"}];
  [self addSubview:contentView];

  _header = [[KBLabel alloc] init];
  [contentView addSubview:_header];
  [contentView addSubview:[YOBox spacing:CGSizeMake(0, 20)]];

  _label = [[KBLabel alloc] init];
  _label.selectable = YES;
  _label.identifier = @"label";
  [contentView addSubview:_label];
  [contentView addSubview:[YOBox spacing:CGSizeMake(0, 30)]];

  _buttonsView = [YOVBox box:@{@"spacing": @(20), @"maxSize": @"240,0", @"horizontalAlignment": @"center"}];
  [contentView addSubview:_buttonsView];

  self.viewLayout = [YOLayout center:contentView];
}

- (void)setHeader:(NSString *)header info:(NSString *)info {
  [self setMessageText:header];
  [self setInformativeText:info];
}

- (void)setMessageText:(NSString *)messageText {
  [_header setText:messageText style:KBTextStyleHeaderLarge alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  [self setNeedsLayout];
}

- (void)setInformativeText:(NSString *)informativeText {
  [_label setText:informativeText font:[KBAppearance.currentAppearance textFont] color:[KBAppearance.currentAppearance textColor] alignment:NSCenterTextAlignment];
  [self setNeedsLayout];
}

- (void)addButtonWithTitle:(NSString *)title tag:(NSInteger)tag {
  GHWeakSelf gself = self;
  KBButton *button = [KBButton buttonWithText:title style:KBButtonStyleDefault];
  button.tag = tag;
  button.targetBlock = ^{
    gself.completion(tag);
    [gself close];
  };
  [_buttonsView addSubview:button];
  [_buttonsView setNeedsLayout];
  [self setNeedsLayout];
}

- (void)showInView:(NSView *)view completion:(KBAlertViewCompletion)completion {
  self.completion = completion;
  NSAssert([view.window isKindOfClass:KBWindow.class], @"Only supported from KBWindow");
  KBWindow *window = (KBWindow *)[view window];
  [window addModalWindowForView:self rect:CGRectMake(0, 0, 620, 420)];
}

- (void)close {
  [self.window close];
}

@end
