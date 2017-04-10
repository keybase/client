//
//  KBProveInputView.m
//  Keybase
//
//  Created by Gabriel on 2/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProveInputView.h"

#import "KBDefines.h"

@interface KBProveInputView ()
@property KBLabel *header;
@property KBLabel *label;
@end

@implementation KBProveInputView

- (void)viewInit {
  [super viewInit];

  _header = [[KBLabel alloc] init];
  [self addSubview:_header];

  _label = [[KBLabel alloc] init];
  [self addSubview:_label];

  _inputField = [[KBTextField alloc] init];
  [self addSubview:_inputField];

  YOHBox *bottomView = [YOHBox box:@{@"spacing": @(20), @"minSize": @"130,0", @"horizontalAlignment": @"center"}];
  [self addSubview:bottomView];
  _cancelButton = [KBButton buttonWithText:@"Cancel" style:KBButtonStyleDefault];
  [bottomView addSubview:_cancelButton];
  _button = [KBButton buttonWithText:@"Connect" style:KBButtonStylePrimary];
  [bottomView addSubview:_button];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;

    y += [layout centerWithSize:CGSizeMake(240, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.header].size.height + 40;
    
    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(40, y, size.width - 80, 0) view:yself.label].size.height + 20;

    y += [layout centerWithSize:CGSizeMake(200, 0) frame:CGRectMake(0, y, size.width, 0) view:yself.inputField].size.height + 40;

    y += [layout centerWithSize:CGSizeMake(300, 0) frame:CGRectMake(0, y, size.width, 0) view:bottomView].size.height;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setServiceName:(NSString *)serviceName {
  _inputField.placeholder = nil;
  _label.attributedText = nil;

  NSString *headerText = KBNameForServiceName(serviceName);
  NSString *headerIcon = nil;
  NSString *labelText = @"What's your username?";
  NSString *placeholder = @"@username";

  if ([serviceName isEqualTo:@"twitter"]) {
    labelText = @"What's your Twitter username?";
    placeholder = @"@username";
    headerIcon = @"twitter";
  } else if ([serviceName isEqualTo:@"github"]) {
    labelText = @"What's your Github username?";
    placeholder = @"username";
    headerIcon = @"github";
  } else if ([serviceName isEqualTo:@"reddit"]) {
    labelText = @"What's your Reddit username?";
    placeholder = @"username";
    headerIcon = @"reddit";
  } else if ([serviceName isEqualTo:@"coinbase"]) {
    labelText = @"What's your Coinbase username?";
    placeholder = @"username";
    headerIcon = @"bitcoin";
  } else if ([serviceName isEqualTo:@"hackernews"]) {
    labelText = @"What's your HackerNews username?";
    placeholder = @"username";
    headerIcon = @"hackerNews";
  } else if ([serviceName isEqualTo:@"dns"]) {
    labelText = @"What domain name do you want to add?";
    placeholder = @"yoursite.com";
  } else if ([serviceName isEqualTo:@"http"]) {
    labelText = @"What website name do you want to add?";
    placeholder = @"yoursite.com";
  } else if ([serviceName isEqualTo:@"https"]) {
    labelText = @"What website name do you want to add?";
    placeholder = @"yoursite.com";
  } else if ([serviceName isEqualTo:@"keybase"]) {
    labelText = @"What's your Keybase username?";
    placeholder = @"username";
  } else if ([serviceName isEqualTo:@"rooter"]) {
    labelText = @"What's your Rooter username?";
    placeholder = @"username";
  }

  if (headerIcon) {
    NSFont *headerFont = [KBAppearance.currentAppearance fontForStyle:KBTextStyleHeaderLarge options:0];
    NSMutableAttributedString *header = [[NSMutableAttributedString alloc] init];
    [header appendAttributedString:[KBFontIcon attributedStringForIcon:headerIcon color:KBAppearance.currentAppearance.selectColor size:headerFont.pointSize alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByClipping sender:self]];
    NSDictionary *attributes = @{NSForegroundColorAttributeName: KBAppearance.currentAppearance.selectColor, NSFontAttributeName: headerFont};
    [header appendAttributedString:[[NSAttributedString alloc] initWithString:NSStringWithFormat(@" %@", headerText) attributes:attributes]];
    [_header setAttributedText:header alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  } else {
    [_header setText:headerText style:KBTextStyleHeaderLarge options:KBTextOptionsSelect alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  }

  [_label setText:labelText font:[KBAppearance.currentAppearance textFont] color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];
  _inputField.placeholder = placeholder;

  [self setNeedsLayout];
}

@end
