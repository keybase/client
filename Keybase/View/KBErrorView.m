//
//  KBErrorView.m
//  Keybase
//
//  Created by Gabriel on 1/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBErrorView.h"

@interface KBErrorView ()
@property KBLabel *label;
//@property KBButton *button;
@end

@implementation KBErrorView

- (void)viewInit {
  [super viewInit];

//  KBLabel *header = [[KBLabel alloc] init];
//  [header setText:@"Oops" font:[NSFont systemFontOfSize:26] color:[KBLookAndFeel errorColor] alignment:NSCenterTextAlignment];
//  [self addSubview:header];

  _label = [[KBLabel alloc] init];
  [self addSubview:_label];

  //GHWeakSelf gself = self;
//  _button = [KBButton buttonWithText:@"Retry"];
//  _button.layer.borderColor = [KBLookAndFeel errorColor].CGColor;
//  self.button.targetBlock = ^{
//  };
//  [self addSubview:_button];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;

    //y += [layout sizeToFitVerticalInFrame:CGRectMake(20, y, size.width - 40, 0) view:header].size.height + 10;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.label].size.height + 20;
//    y += [layout setFrame:CGRectMake(20, y, size.width - 40, KBDefaultButtonHeight) view:yself.button].size.height;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setError:(NSError *)error {
  self.hidden = !error;
  [_label setText:error.localizedDescription font:[NSFont systemFontOfSize:18] color:[KBLookAndFeel errorColor] alignment:NSCenterTextAlignment];
  [self setNeedsLayout];
}

@end
