//
//  KBFileIconLabel.m
//  Keybase
//
//  Created by Gabriel on 3/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFileIcon.h"

@interface KBFileIcon ()
@property KBImageView *imageView;
@property KBLabel *nameLabel;
@end

@implementation KBFileIcon

- (void)viewInit {
  [super viewInit];

  _iconHeight = 120; // Default
  _font = [NSFont systemFontOfSize:12];

  _imageView = [[KBImageView alloc] init];
  [self addSubview:_imageView];

  _nameLabel = [[KBLabel alloc] init];
  [self addSubview:_nameLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {

    CGSize labelSize = [yself.nameLabel sizeThatFits:CGSizeMake(size.width, 0)];

    CGFloat iconHeight = yself.iconHeight;
    if (size.width > 0) iconHeight = MIN(iconHeight, size.width - labelSize.height - 10);
    if (size.height > 0) iconHeight = MIN(iconHeight, size.height - labelSize.height - 10);

    if (![layout isSizing]) {
      // Force the image size to be the right height... Scaling only does downscale, not upscale :(
      yself.imageView.image.size = CGSizeMake(iconHeight, iconHeight);
    }

    CGFloat y = CGRectGetMaxY([layout centerWithSize:CGSizeMake(iconHeight, iconHeight) frame:CGRectMake(0, 0, size.width, iconHeight) view:yself.imageView]);

    y += 10;
    y += [layout centerWithSize:labelSize frame:CGRectMake(0, y, size.width, labelSize.height) view:yself.nameLabel].size.height;

    return CGSizeMake(size.width, y);
  }];
}

- (void)setFile:(KBFile *)file {
  _file = file;
  [_nameLabel setText:_file.name font:_font color:KBAppearance.currentAppearance.textColor alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByCharWrapping];
  _imageView.image = file.icon;
  [self setNeedsLayout];
}

@end
