//
//  KBImageTextView.m
//  Keybase
//
//  Created by Gabriel on 2/18/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBImageTextView.h"

@interface KBImageTextView ()
@property KBImageView *imageView;
@property KBLabel *titleLabel;
@property KBLabel *infoLabel;
@property KBBox *border;

@property NSString *title;
@property NSString *info;
@property NSString *imageSource;
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

  _infoLabel = [[KBLabel alloc] init];
  [self addSubview:_infoLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 10;
    CGFloat y = 8;

    CGFloat minY = 0;
    if (yself.imageView.image || yself.imageSize.width > 0) {
      CGRect imageViewFrame = [layout setFrame:CGRectMake(x, y, MAX(40, yself.imageSize.width), MAX(40, yself.imageSize.height)) view:yself.imageView];
      x += 50;
      minY = imageViewFrame.origin.y + imageViewFrame.size.height;
    }

    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x, 0) view:yself.titleLabel].size.height + 2;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(x, y, size.width - x, 0) view:yself.infoLabel].size.height;

    y = MAX(y, minY) + 8;

    [layout setFrame:CGRectMake(0, y - 0.5, size.width, 1) view:yself.border];
    return CGSizeMake(size.width, y);
  }];
}

- (void)setTitle:(NSString *)title info:(NSString *)info imageSource:(NSString *)imageSource appearance:(id<KBAppearance>)appearance {
  _title = title;
  _info = info;
  _imageSource = imageSource;
  [self.titleLabel setText:title font:appearance.boldTextFont color:appearance.textColor alignment:NSLeftTextAlignment];
  [self.infoLabel setText:info style:KBLabelStyleSecondaryText appearance:appearance];
  [self.imageView setImageSource:imageSource];
  [self setNeedsLayout];
}

- (void)setBackgroundStyle:(NSBackgroundStyle)backgroundStyle {
  id<KBAppearance> appearance = (backgroundStyle == NSBackgroundStyleDark ? KBAppearance.darkAppearance : KBAppearance.lightAppearance);
  [self setTitle:_title info:_info imageSource:_imageSource appearance:appearance];
}

@end
