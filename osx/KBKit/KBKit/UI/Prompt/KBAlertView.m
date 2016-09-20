//
//  KBAlertView.m
//  Keybase
//
//  Created by Gabriel on 6/3/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBAlertView.h"

#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBAlertView ()
@property KBLabel *header;
@property KBLabel *label;
@property YOVBox *buttonsView;
@end

@implementation KBAlertView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  YOVBox *contentView = [YOVBox box:@{@"spacing": @(20), @"insets": @"10,80,10,80"}];
  [self addSubview:contentView];

  _header = [[KBLabel alloc] init];
  [contentView addSubview:_header];

  _label = [[KBLabel alloc] init];
  _label.selectable = YES;
  _label.identifier = @"label";
  [contentView addSubview:_label];

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
  [_label setText:informativeText style:KBTextStyleDefault options:0 alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
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
