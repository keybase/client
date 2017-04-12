//
//  KBTestView.m
//  Keybase
//
//  Created by Gabriel on 2/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBStyleGuideView.h"

#import "KBFileIcon.h"
#import "KBComponent.h"
#import "KBDebugViews.h"
#import "KBRMockClient.h"
#import "KBFontIcon.h"

#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBStyleGuideView ()
@property KBProgressOverlayView *progressView;
@end

@implementation KBStyleGuideView

- (void)viewInit {
  [super viewInit];

  NSString *title = @"Blue Bottle Etsy Gentrify";
  NSString *shortText = @"Street art Vice Kickstarter Odd Future Tumblr, Brooklyn Carles cronut wolf umami meggings actually bespoke.";
  NSString *longText = @"Portland pug normcore, heirloom meggings small batch skateboard next level vinyl drinking vinegar 90's messenger bag iPhone DIY blog. Polaroid +1 chia, direct trade art party ennui fixie. Listicle readymade fashion axe ethical, scenester irony American Apparel DIY XOXO.";

  YOVBox *contentView = [YOVBox box:@{@"spacing": @"10", @"insets": @"20"}];
  [contentView kb_setBackgroundColor:KBAppearance.currentAppearance.secondaryBackgroundColor];

  KBLabel *label1 = [[KBLabel alloc] initWithFrame:CGRectMake(0, 0, 200, 30)];
  [label1 setMarkup:@"Text <strong>Strong</strong> <em>Emphasis</em>\n<thin>Thin text</thin>" font:[NSFont systemFontOfSize:16] color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping];
  label1.insets = UIEdgeInsetsMake(4, 10, 4, 10);
  [label1 setBorderWithColor:NSColor.blueColor width:0.5];
  [contentView addSubview:label1];

  KBImageTextView *imageTextView = [[KBImageTextView alloc] initWithFrame:CGRectMake(0, 0, 200, 30)];
  imageTextView.imageSize = CGSizeMake(40, 40);
  [imageTextView setTitle:shortText info:longText imageURLString:@"http://dummyimage.com/120x120/000/fff" imageSize:CGSizeMake(30, 30) lineBreakMode:NSLineBreakByWordWrapping];
  [contentView addSubview:imageTextView];

  KBHoverView *popover = [[KBHoverView alloc] initWithFrame:CGRectMake(0, 0, 200, 0)];
  [popover setText:longText title:title];
  [contentView addSubview:popover];

  YOVBox *buttonView = [YOVBox box:@{@"spacing": @(20)}];
  {
    YOHBox *buttons = [YOHBox box:@{@"spacing": @(10), @"minSize": @"100,0"}];
    {
      KBButton *buttonPrimary = [KBButton buttonWithText:@"Primary" style:KBButtonStylePrimary];
      [buttons addSubview:buttonPrimary];

      KBButton *buttonDefault = [KBButton buttonWithText:@"Default" style:KBButtonStyleDefault];
      [buttons addSubview:buttonDefault];

      KBButton *warningDefault = [KBButton buttonWithText:@"Warning" style:KBButtonStyleWarning];
      [buttons addSubview:warningDefault];

      KBButton *dangerDefault = [KBButton buttonWithText:@"Danger" style:KBButtonStyleDanger];
      [buttons addSubview:dangerDefault];
    }
    [buttonView addSubview:buttons];

    YOHBox *buttonsToolbar = [YOHBox box:@{@"spacing": @(10), @"minSize": @"100,0"}];
    {
      KBButton *buttonPrimaryToolbar = [KBButton buttonWithText:@"Toolbar" style:KBButtonStylePrimary options:KBButtonOptionsToolbar];
      [buttonsToolbar addSubview:buttonPrimaryToolbar];

      KBButton *buttonDefaultToolbar = [KBButton buttonWithText:@"Toolbar" style:KBButtonStyleDefault options:KBButtonOptionsToolbar];
      [buttonsToolbar addSubview:buttonDefaultToolbar];

      KBButton *warningDefaultToolbar = [KBButton buttonWithText:@"Toolbar" style:KBButtonStyleWarning options:KBButtonOptionsToolbar];
      [buttonsToolbar addSubview:warningDefaultToolbar];

      KBButton *dangerDefaultToolbar = [KBButton buttonWithText:@"Toolbar" style:KBButtonStyleDanger options:KBButtonOptionsToolbar];
      [buttonsToolbar addSubview:dangerDefaultToolbar];
    }
    [buttonView addSubview:buttonsToolbar];

    YOHBox *buttonsToolbarToggle = [YOHBox box:@{@"spacing": @(10), @"minSize": @"100,0"}];
    {
      KBButton *buttonPrimaryToolbar = [KBButton buttonWithText:@"Toggle" style:KBButtonStylePrimary options:KBButtonOptionsToolbar|KBButtonOptionsToggle];
      [buttonsToolbarToggle addSubview:buttonPrimaryToolbar];

      KBButton *buttonDefaultToolbar = [KBButton buttonWithText:@"Toggle" style:KBButtonStyleDefault options:KBButtonOptionsToolbar|KBButtonOptionsToggle];
      [buttonsToolbarToggle addSubview:buttonDefaultToolbar];

      KBButton *warningDefaultToolbar = [KBButton buttonWithText:@"Toggle" style:KBButtonStyleWarning options:KBButtonOptionsToolbar|KBButtonOptionsToggle];
      [buttonsToolbarToggle addSubview:warningDefaultToolbar];

      KBButton *dangerDefaultToolbar = [KBButton buttonWithText:@"Toggle" style:KBButtonStyleDanger options:KBButtonOptionsToolbar|KBButtonOptionsToggle];
      [buttonsToolbarToggle addSubview:dangerDefaultToolbar];
    }
    [buttonView addSubview:buttonsToolbarToggle];

    YOHBox *buttonsIcon = [YOHBox box:@{@"spacing": @(10), @"minSize": @"100,0"}];
    {
      KBButton *buttonImageText = [KBFontIcon buttonForIcon:@"angleLeft" text:@"Back" style:KBButtonStyleDefault options:0 sender:self];
      [buttonsIcon addSubview:buttonImageText];
    }
    [buttonView addSubview:buttonsIcon];
  }
  [contentView addSubview:buttonView];

  YOBox *linkView = [YOBox box:@{@"spacing": @(10), @"minSize": @"200,40"}];
  [contentView addSubview:linkView];

  KBButton *activityToggleLink = [KBButton buttonWithText:@"Toggle Activity" style:KBButtonStyleLink];
  activityToggleLink.targetBlock = ^{ [self toggleActivity]; };
  [linkView addSubview:activityToggleLink];

  KBButton *activityToggleTitleLink = [KBButton buttonWithText:@"Toggle Activity\n(Title Bar)" style:KBButtonStyleLink];
  activityToggleTitleLink.targetBlock = ^{ [self toggleActivityTitleBar]; };
  [linkView addSubview:activityToggleTitleLink];

  _progressView = [[KBProgressOverlayView alloc] init];
  [contentView addSubview:_progressView];
  _progressView.animating = YES;

  YOVBox *textFieldsView = [YOVBox box:@{@"spacing": @(20), @"insets": @(40)}];
  [contentView addSubview:textFieldsView];
  KBTextField *textField = [[KBTextField alloc] init];
  textField.placeholder = @"Text Field";
  [textFieldsView addSubview:textField];

  KBSecureTextField *secureTextField = [[KBSecureTextField alloc] init];
  secureTextField.placeholder = @"Secure Text Field";
  [textFieldsView addSubview:secureTextField];

  KBBorder *border = [[KBBorder alloc] initWithFrame:CGRectMake(0, 0, 100, 50)];
  border.width = 1.0;
  border.color = NSColor.blueColor;
  border.cornerRadius = 6.0;
  border.shapeLayer.fillColor = NSColor.whiteColor.CGColor;
  [border updatePath];
  [contentView addSubview:border];

  KBFileIcon *icon = [[KBFileIcon alloc] init];
  [icon setFile:[KBFile fileWithPath:@"~/Temp/test-a-really-long-file-name.txt"]];
  [contentView addSubview:icon];

  KBFileIcon *icon2 = [[KBFileIcon alloc] init];
  icon2.iconHeight = 60;
  [icon2 setFile:[KBFile fileWithPath:@"~/Temp/test-a-really-long-file-name-a-really-long-file-name-a-really-long-file-name-a-really-long-file-name.txt"]];
  [contentView addSubview:icon2];

  KBLabel *fontAwesomeLabel = [[KBLabel alloc] init];
  [contentView addSubview:fontAwesomeLabel];

  NSMutableAttributedString *icons = [[NSMutableAttributedString alloc] init];
  NSDictionary *largeAttributes = @{NSForegroundColorAttributeName: KBAppearance.currentAppearance.selectColor, NSFontAttributeName: [NSFont systemFontOfSize:32]};
  [icons appendAttributedString:[KBFontIcon attributedStringForIcon:@"twitter" color:KBAppearance.currentAppearance.selectColor size:32 alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping sender:self]];
  [icons appendAttributedString:[[NSAttributedString alloc] initWithString:@" Twitter\n" attributes:largeAttributes]];

  [icons appendAttributedString:[KBFontIcon attributedStringForIcon:@"reddit" appearance:KBAppearance.currentAppearance style:KBTextStyleHeaderLarge options:KBTextOptionsSelect alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping sender:self]];
  [icons appendAttributedString:[[NSAttributedString alloc] initWithString:@" Reddit\n" attributes:largeAttributes]];

  [icons appendAttributedString:[KBFontIcon attributedStringForIcon:@"github" appearance:KBAppearance.currentAppearance style:KBTextStyleDefault options:0 alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByClipping sender:self]];
  NSDictionary *attributes = @{NSForegroundColorAttributeName: KBAppearance.currentAppearance.textColor, NSFontAttributeName: [NSFont systemFontOfSize:14]};
  [icons appendAttributedString:[[NSAttributedString alloc] initWithString:@" gabriel\n" attributes:attributes]];

  [fontAwesomeLabel setAttributedText:icons];

  [self addSubview:contentView];
  self.viewLayout = [YOLayout fitVertical:contentView];
}

- (void)open:(id)sender {
  [[sender window] kb_addChildWindowForView:self rect:CGRectMake(0, 40, 400, 600) position:KBWindowPositionLeft title:@"Style Guide" fixed:NO makeKey:NO];
}

- (void)toggleActivity {
  _progressView.animating = !_progressView.isAnimating;
}

- (void)toggleActivityTitleBar {
  self.navigation.titleView.progressEnabled = !self.navigation.titleView.progressEnabled;
}

#pragma mark KBComponent

- (NSString *)name {
  return @"Style Guide";
}

- (NSString *)info {
  return @"UI Components and mocks";
}

- (NSImage *)image {
  return [KBIcons imageForIcon:KBIconColors];
}

- (NSView *)componentView {
  YOVBox *view = [YOVBox box];
  KBDebugViews *debugViews = [[KBDebugViews alloc] init];
  debugViews.client = [[KBRMockClient alloc] init];
  [view addSubview:debugViews];
  KBScrollView *scrollView = [KBScrollView scrollViewWithDocumentView:view];
  return scrollView;
}

- (void)refreshComponent:(KBRefreshComponentCompletion)completion {
  completion(nil);
}

@end
