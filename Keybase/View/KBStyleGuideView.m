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

  KBLabel *label1 = [[KBLabel alloc] init];
  [label1 setBackgroundColor:[NSColor colorWithWhite:0.9 alpha:1.0]];
  [self addSubview:label1];
  [label1 setMarkup:@"Text <strong>Strong</strong> <em>Emphasis</em>" font:[NSFont systemFontOfSize:16] color:[KBLookAndFeel textColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

  KBLabel *label2 = [[KBLabel alloc] initWithFrame:CGRectMake(0, 0, 200, 50)];
  label2.verticalAlignment = KBTextAlignmentMiddle;
  [label2 setBorderWithColor:NSColor.blackColor width:1.0];
  [label2 setText:@"Text Middle Align" font:[NSFont systemFontOfSize:16] color:NSColor.blackColor alignment:NSCenterTextAlignment];
  [self addSubview:label2];

  KBButton *buttonPrimary = [KBButton buttonWithText:@"Primary" style:KBButtonStylePrimary];
  buttonPrimary.targetBlock = ^{
    KBStyleGuideView *testView = [[KBStyleGuideView alloc] init];
    [self.navigation pushView:testView animated:YES];
  };
  [self addSubview:buttonPrimary];

  KBButton *buttonDefault = [KBButton buttonWithText:@"Default" style:KBButtonStyleDefault];
  buttonDefault.targetBlock = ^{
    KBStyleGuideView *testView = [[KBStyleGuideView alloc] init];
    [self.navigation pushView:testView animated:YES];
  };
  [self addSubview:buttonDefault];

  KBButton *buttonLink = [KBButton buttonWithText:@"Link" style:KBButtonStyleLink];
  buttonLink.targetBlock = ^{

  };
  [self addSubview:buttonLink];

  self.viewLayout = [YOLayout vertical:self margin:UIEdgeInsetsMake(20, 40, 20, 40) padding:20];
}


@end
