//
//  KBImageLabel.m
//  Keybase
//
//  Created by Gabriel on 4/30/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBImageLabel.h"

@interface KBImageLabel ()
@property KBImageView *imageView;
@property KBLabel *nameLabel;
@end

@implementation KBImageLabel

- (void)viewInit {
  [super viewInit];

  _imageView = [[KBImageView alloc] init];
  [self addSubview:_imageView];

  _nameLabel = [[KBLabel alloc] init];
  [self addSubview:_nameLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 6;

    CGFloat iconWidth = size.height - ceilf(size.height / 5.0);
    x += [layout centerWithSize:CGSizeMake(iconWidth, iconWidth) frame:CGRectMake(x, 0, 16, size.height) view:yself.imageView].size.width + 7;
    [layout centerWithSize:CGSizeMake(size.width - x, 0) frame:CGRectMake(x, 0, 0, size.height) view:yself.nameLabel];

    return size;
  }];
}

+ (NSFont *)fontForStyle:(KBImageLabelStyle)style {
  switch (style) {
    case KBImageLabelStyleDefault: return [NSFont systemFontOfSize:13];
    case KBImageLabelStyleLarge: return [NSFont systemFontOfSize:14];
  }
}

- (void)setBackgroundStyle:(NSBackgroundStyle)backgroundStyle {
  id<KBAppearance> appearance = (backgroundStyle == NSBackgroundStyleDark ? KBAppearance.darkAppearance : KBAppearance.lightAppearance);
  [self.nameLabel setColor:appearance.textColor];
  [self setNeedsLayout];
}

@end
