//
//  KBTestView.m
//  Keybase
//
//  Created by Gabriel on 2/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBStyleGuideView.h"

@interface KBStyleGuideView ()
@end

@implementation KBStyleGuideView

- (void)viewInit {
  [super viewInit];

  YONSView *contentView = [[YONSView alloc] init];
  [self addSubview:contentView];

  KBLabel *label1 = [[KBLabel alloc] init];
  [label1 setBackgroundColor:[NSColor colorWithWhite:0.9 alpha:1.0]];
  [label1 setMarkup:@"Text <strong>Strong</strong> <em>Emphasis</em>" font:[NSFont systemFontOfSize:16] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  [contentView addSubview:label1];

  KBLabel *label2 = [[KBLabel alloc] initWithFrame:CGRectMake(0, 0, 200, 50)];
  label2.verticalAlignment = KBTextAlignmentMiddle;
  [label2 setBorderWithColor:NSColor.blackColor width:1.0];
  [label2 setText:@"Text Middle Align" font:[NSFont systemFontOfSize:16] color:NSColor.blackColor alignment:NSCenterTextAlignment];
  [contentView addSubview:label2];

  KBButton *buttonPrimary = [KBButton buttonWithText:@"Primary" style:KBButtonStylePrimary];
  buttonPrimary.targetBlock = ^{
    KBStyleGuideView *testView = [[KBStyleGuideView alloc] init];
    [self.navigation pushView:testView animated:YES];
  };
  [contentView addSubview:buttonPrimary];

  KBButton *buttonDefault = [KBButton buttonWithText:@"Default" style:KBButtonStyleDefault];
  buttonDefault.targetBlock = ^{
    KBStyleGuideView *testView = [[KBStyleGuideView alloc] init];
    [self.navigation pushView:testView animated:YES];
  };
  [contentView addSubview:buttonDefault];

  KBButton *buttonLink = [KBButton buttonWithText:@"Link" style:KBButtonStyleLink];
  buttonLink.targetBlock = ^{

  };
  [contentView addSubview:buttonLink];

  KBTextField *textField = [[KBTextField alloc] init];
  textField.placeholder = @"Text Field";
  [contentView addSubview:textField];

  KBSecureTextField *secureTextField = [[KBSecureTextField alloc] init];
  secureTextField.placeholder = @"Secure Text Field";
  [contentView addSubview:secureTextField];

  contentView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    for (id subview in contentView.subviews) {
      CGRect frame = [subview frame];
      if (frame.size.height > 0) {
        y += [layout setFrame:CGRectMake(40, y, size.width - 80, frame.size.height) view:subview].size.height;
      } else {
        y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:subview].size.height;
      }
      y += 20;
    }
    return CGSizeMake(size.width, y);
  }];

  NSScrollView *scrollView = [[NSScrollView alloc] init];
  [scrollView setHasVerticalScroller:YES];
  [scrollView setAutoresizingMask:NSViewWidthSizable|NSViewHeightSizable];
  [scrollView setDocumentView:contentView];
  [self addSubview:scrollView];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    [layout sizeToFitVerticalInFrame:CGRectMake(0, 0, size.width, 0) view:contentView];
    [layout setSize:size view:scrollView options:0];
    return size;
  }];
}


@end
