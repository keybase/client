//
//  KBFileIconLabel.m
//  Keybase
//
//  Created by Gabriel on 3/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFileIconLabel.h"

@implementation KBFileIconLabel

- (void)viewInit {
  [super viewInit];

  _iconHeight = 120; // Default

  _imageView = [[KBImageView alloc] init];
  [self addSubview:_imageView];

  _nameLabel = [[KBLabel alloc] init];
  [self addSubview:_nameLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {

    CGFloat iconHeight = self.iconHeight;
    CGFloat width = iconHeight + 30;

    CGSize labelSize = [yself.nameLabel sizeThatFits:CGSizeMake(width, 40)];

    CGFloat height = iconHeight + labelSize.height + 8;

    [layout centerWithSize:CGSizeMake(iconHeight, iconHeight) frame:CGRectMake(0, 0, size.width, 0) view:yself.imageView];

    if (![layout isSizing]) {
      // Force the image size to be the right height... Scaling only does downscale, not upscale :(
      yself.imageView.image.size = CGSizeMake(iconHeight, iconHeight);
    }

    [layout centerWithSize:labelSize frame:CGRectMake(0, iconHeight + 8, size.width, labelSize.height) view:yself.nameLabel];

    return CGSizeMake(width, height);
  }];
}

- (void)setPath:(NSString *)path {
  _path = path;
  NSString *filename = [path lastPathComponent];
  [_nameLabel setText:filename font:[NSFont systemFontOfSize:12] color:KBAppearance.currentAppearance.textColor alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByCharWrapping]; // style:KBLabelStyleDefault alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  _imageView.image = [[NSWorkspace sharedWorkspace] iconForFile:path];
  [self setNeedsLayout];
}

- (void)setFolder:(KBFolder *)folder {
  NSImage *image = KBImageForFolder(folder);
  image.size = CGSizeMake(120, 120);
  self.imageView.image = image;
  [self.nameLabel setText:folder.name style:KBLabelStyleHeader alignment:NSCenterTextAlignment lineBreakMode:NSLineBreakByCharWrapping];
  [self setNeedsLayout];
}

@end
