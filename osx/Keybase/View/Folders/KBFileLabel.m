//
//  KBFolderView.m
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFileLabel.h"

@interface KBFileLabel ()
@property KBImageView *imageView;
@property KBLabel *nameLabel;
@end


@implementation KBFileLabel

- (void)viewInit {
  [super viewInit];

  _imageView = [[KBImageView alloc] init];
  [self addSubview:_imageView];

  _nameLabel = [[KBLabel alloc] init];
  [self addSubview:_nameLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 6;

    CGFloat iconWidth = size.height - roundf(size.height / 5.0);
    x += [layout centerWithSize:CGSizeMake(iconWidth, iconWidth) frame:CGRectMake(x, 0, 16, size.height) view:yself.imageView].size.width + 7;
    [layout centerWithSize:CGSizeMake(size.width - x, 0) frame:CGRectMake(x, 0, 0, size.height) view:yself.nameLabel];

    return size;
  }];
}

+ (NSFont *)fontForStyle:(KBFileLabelStyle)fileLabelStyle {
  switch (fileLabelStyle) {
    case KBFileLabelStyleDefault: return [NSFont systemFontOfSize:13];
    case KBFileLabelStyleLarge: return [NSFont systemFontOfSize:14];
  }
}

- (void)setFile:(KBFile *)file {
  [self.nameLabel setText:file.name font:[self.class fontForStyle:_fileLabelStyle] color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  self.imageView.image = file.icon;
  [self setNeedsLayout];
}

- (void)setBackgroundStyle:(NSBackgroundStyle)backgroundStyle {
  id<KBAppearance> appearance = (backgroundStyle == NSBackgroundStyleDark ? KBAppearance.darkAppearance : KBAppearance.lightAppearance);
  [self.nameLabel setFont:[self.class fontForStyle:_fileLabelStyle] color:appearance.textColor];
  [self setNeedsLayout];
}

/*
- (void)setFolder:(KBFolder *)folder {
  [self.textField setStringValue:folder.name];
  self.imageView.image = [NSImage imageNamed:@"GenericFolderIcon.icns"];
  self.needsDisplay = YES;
}
 */

@end