//
//  KBTestView.m
//  Keybase
//
//  Created by Gabriel on 2/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTestView.h"

@interface KBTestView ()
@property KBLabel *label;
@end

@implementation KBTestView

- (void)viewInit {
  [super viewInit];

  _label = [[KBLabel alloc] init];
  [_label setBackgroundColor:[NSColor colorWithWhite:0.9 alpha:1.0]];
  [self addSubview:_label];

  [_label setMarkup:NSStringWithFormat(@"<strong>Publicly track \"%@\"?</strong> <em>This is recommended.</em>", @"test") font:[NSFont systemFontOfSize:14] color:[NSColor blackColor] alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByWordWrapping];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(40, y, size.width - 80, 0) view:yself.label].size.height + 10;

    //GHDebug(@"Label height: %@", @(yself.label.frame.size.height));

    return CGSizeMake(size.width, y);
  }];

}


@end
