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

@property NSImage *image;
@property NSImage *imageTinted;
@end

@implementation KBImageTextView

- (void)viewInit {
  [super viewInit];
  self.wantsLayer = YES;
  [self.layer setBackgroundColor:NSColor.clearColor.CGColor];

  _imageView = [self loadImageView];
  [self addSubview:_imageView];

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

- (KBImageView *)loadImageView {
  return [[KBImageView alloc] init];
}

- (void)setTitle:(NSString *)title info:(NSString *)info imageSource:(NSString *)imageSource {
  [self.titleLabel setText:title font:KBAppearance.currentAppearance.boldTextFont color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment];
  [self.infoLabel setText:info style:KBLabelStyleSecondaryText appearance:KBAppearance.currentAppearance];
  [self.imageView setImageSource:imageSource];
  self.image = nil;
  self.imageTinted = nil;
  [self setNeedsLayout];
}

- (void)setBackgroundStyle:(NSBackgroundStyle)backgroundStyle {
  id<KBAppearance> appearance = (backgroundStyle == NSBackgroundStyleDark ? KBAppearance.darkAppearance : KBAppearance.lightAppearance);
  [self.titleLabel setFont:appearance.boldTextFont color:appearance.textColor];
  [self.infoLabel setStyle:KBLabelStyleSecondaryText appearance:appearance];

  if (self.tintImageForStyle) {
    if (backgroundStyle == NSBackgroundStyleDark && self.imageView.image) {
      self.image = self.imageView.image;
      self.imageTinted = [self.imageView imageTintedWithColor:NSColor.whiteColor];
      self.imageView.image = self.imageTinted;
    } else if (self.image) {
      self.imageView.image = self.image;
    }
  }

  // Prevent lag on cell selection state change
  [self display];
}

@end
