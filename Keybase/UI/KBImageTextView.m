//
//  KBImageTextView.m
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBImageTextView.h"

#import "KBImageView.h"
#import "KBLabel.h"
#import "KBBox.h"
#import "KBAppearance.h"

@interface KBImageTextView ()
@property KBImageView *imageView;
@property KBLabel *titleLabel;
@property KBLabel *descriptionLabel;
@property KBBox *border;
@end

@implementation KBImageTextView

- (void)viewInit {
  [super viewInit];
  self.wantsLayer = YES;
  [self.layer setBackgroundColor:NSColor.clearColor.CGColor];

  _imageView = [[KBImageView alloc] init];
  //_imageView.roundedRatio = 1.0;
  [self addSubview:self.imageView];

  _titleLabel = [[KBLabel alloc] init];
  [self addSubview:_titleLabel];

  _border = [KBBox lineWithWidth:1.0 color:[KBAppearance.currentAppearance lineColor]];
  [self addSubview:_border];

  _descriptionLabel = [[KBLabel alloc] init];
  [self addSubview:_descriptionLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 10;
    CGFloat y = 10;

    CGFloat minHeight = 0;
    if (yself.imageView.image) {
      [layout setFrame:CGRectMake(x, y, 40, 40) view:yself.imageView];
      x += 50;
      minHeight = 60;
    }

    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x, 0) view:yself.titleLabel].size.height;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x, 0) view:yself.descriptionLabel].size.height + 10;

    if (y < minHeight) y = minHeight;

    [layout setFrame:CGRectMake(0, y - 0.5, size.width, 1) view:yself.border];
    return CGSizeMake(size.width, y);
  }];
}

- (void)setTitle:(NSString *)title description:(NSString *)description imageSource:(NSString *)imageSource {
  [self.titleLabel setText:title font:[NSFont boldSystemFontOfSize:14] color:[KBAppearance.currentAppearance textColor] alignment:NSLeftTextAlignment];
  [self.descriptionLabel setText:description font:[NSFont systemFontOfSize:14] color:[KBAppearance.currentAppearance secondaryTextColor] alignment:NSLeftTextAlignment];
  [self.imageView setImageSource:imageSource];
  [self setNeedsLayout];
}

@end
