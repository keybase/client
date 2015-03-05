//
//  KBTestView.m
//  Keybase
//
//  Created by Gabriel on 2/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBStyleGuideView.h"

@interface KBStyleGuideView ()
@property KBProgressOverlayView *progressView;
@end

@implementation KBStyleGuideView

- (void)viewInit {
  [super viewInit];

  NSString *title = @"Blue Bottle Etsy Gentrify";
  NSString *shortText = @"Street art Vice Kickstarter Odd Future Tumblr, Brooklyn Carles cronut wolf umami meggings actually bespoke.";
  NSString *longText = @"Portland pug normcore, heirloom meggings small batch skateboard next level vinyl drinking vinegar 90's messenger bag iPhone DIY blog. Polaroid +1 chia, direct trade art party ennui fixie. Listicle readymade fashion axe ethical, scenester irony American Apparel DIY XOXO.";

  YONSView *contentView = [[YONSView alloc] init];
  contentView.wantsLayer = YES;
  contentView.layer.backgroundColor = NSColor.whiteColor.CGColor;

  KBLabel *label1 = [[KBLabel alloc] initWithFrame:CGRectMake(0, 0, 200, 30)];
  [label1 setBackgroundColor:[NSColor colorWithWhite:0.9 alpha:1.0]];
  [label1 setMarkup:@"Text <strong>Strong</strong> <em>Emphasis</em>" font:[NSFont systemFontOfSize:16] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  [contentView addSubview:label1];

//  KBLabel *label2 = [[KBLabel alloc] initWithFrame:CGRectMake(0, 0, 200, 50)];
//  label2.verticalAlignment = KBVerticalAlignmentMiddle;
//  [label2 setBorderWithColor:NSColor.blackColor width:1.0];
//  [label2 setText:@"Text Middle Align with border" font:[NSFont systemFontOfSize:16] color:NSColor.blackColor alignment:NSCenterTextAlignment];
//  [contentView addSubview:label2];

  KBImageTextView *imageTextView = [[KBImageTextView alloc] initWithFrame:CGRectMake(0, 0, 200, 30)];
  imageTextView.imageSize = CGSizeMake(40, 40);
  [imageTextView setTitle:title info:shortText imageSource:@"30-Hardware-black-computer-30"];
  [contentView addSubview:imageTextView];

  KBPopoverView *popover = [[KBPopoverView alloc] initWithFrame:CGRectMake(0, 0, 200, 0)];
  [popover setText:longText title:title];
  [contentView addSubview:popover];

  YONSView *buttonView = [[YONSView alloc] init];
  KBButton *buttonPrimary = [KBButton buttonWithText:@"Primary" style:KBButtonStylePrimary];
  buttonPrimary.targetBlock = ^{ };
  [buttonView addSubview:buttonPrimary];

  KBButton *buttonDefault = [KBButton buttonWithText:@"Default" style:KBButtonStyleDefault];
  buttonDefault.targetBlock = ^{ };
  [buttonView addSubview:buttonDefault];

  buttonView.viewLayout = [YOLayout layoutWithLayoutBlock:[KBLayouts gridLayoutForViews:buttonView.subviews viewSize:CGSizeMake(200, 42) padding:10]];
  [contentView addSubview:buttonView];

  YONSView *linkView = [[YONSView alloc] init];
  KBButton *openSheetLink = [KBButton buttonWithText:@"Open Sheet" style:KBButtonStyleLink];
  openSheetLink.targetBlock = ^{ [self openSheet]; };
  [linkView addSubview:openSheetLink];

  KBButton *activityToggleLink = [KBButton buttonWithText:@"Toggle Activity" style:KBButtonStyleLink];
  activityToggleLink.targetBlock = ^{ [self toggleActivity]; };
  [linkView addSubview:activityToggleLink];

  KBButton *activityToggleTitleLink = [KBButton buttonWithText:@"Toggle Activity\n(Title Bar)" style:KBButtonStyleLink];
  activityToggleTitleLink.targetBlock = ^{ [self toggleActivityTitleBar]; };
  [linkView addSubview:activityToggleTitleLink];

  linkView.viewLayout = [YOLayout vertical:linkView.subviews margin:UIEdgeInsetsMake(0, 0, 0, 0) padding:10];
  [contentView addSubview:linkView];

  _progressView = [[KBProgressOverlayView alloc] init];
  [contentView addSubview:_progressView];
  _progressView.animating = YES;

  YONSView *textFieldsView = [[YONSView alloc] init];
  KBTextField *textField = [[KBTextField alloc] init];
  textField.placeholder = @"Text Field";
  [textFieldsView addSubview:textField];

  KBSecureTextField *secureTextField = [[KBSecureTextField alloc] init];
  secureTextField.placeholder = @"Secure Text Field";
  [textFieldsView addSubview:secureTextField];
  textFieldsView.viewLayout = [YOLayout vertical:textFieldsView.subviews margin:UIEdgeInsetsMake(0, 40, 0, 40) padding:20];
  [contentView addSubview:textFieldsView];

  contentView.viewLayout = [YOLayout vertical:contentView.subviews margin:UIEdgeInsetsMake(20, 20, 20, 20) padding:10];

  KBScrollView *scrollView = [[KBScrollView alloc] init];
  [scrollView setDocumentView:contentView];
  [self addSubview:scrollView];
  self.viewLayout = [YOLayout fill:scrollView];
}

- (void)openSheet {
  YONSView *view = [[YONSView alloc] init];
  view.wantsLayer = YES;
  view.layer.backgroundColor = NSColor.whiteColor.CGColor;
  KBButton *button = [KBButton buttonWithText:@"Close" style:KBButtonStyleDefault];
  button.frame = CGRectMake(100, 20, 100, 42);
  [view addSubview:button];

  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:view title:@"Sheet"];
  NSWindow *window = [KBWindow windowWithContentView:navigation size:CGSizeMake(300, 200) retain:YES];
  
  [self.window beginSheet:window completionHandler:^(NSModalResponse returnCode) {}];

  button.targetBlock = ^{ [self.window endSheet:window]; };
}

- (void)toggleActivity {
  _progressView.animating = !_progressView.isAnimating;
}

- (void)toggleActivityTitleBar {
  self.navigation.titleView.progressEnabled = !self.navigation.titleView.progressEnabled;
}

@end
