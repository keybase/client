//
//  KBFolderView.m
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFolderView.h"

@interface KBFolderView ()
@property KBImageView *imageView;
@property KBLabel *nameLabel;
@end


@implementation KBFolderView

- (void)viewInit {
  [super viewInit];

  _imageView = [[KBImageView alloc] init];
  [self addSubview:_imageView];

  _nameLabel = [[KBLabel alloc] init];
  [self addSubview:_nameLabel];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 6;
    CGFloat y = 2;

    x += [layout setFrame:CGRectMake(x, 2, 16, 16) view:yself.imageView].size.width + 7;

    [layout setFrame:CGRectMake(x, y, size.width - x, 20) view:yself.nameLabel];

    y += 20;

    return CGSizeMake(size.width, y);
  }];
}


//
// Icons in:
// /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/
//

- (void)setFolder:(KBFolder *)folder {
  [self.nameLabel setText:folder.name style:KBLabelStyleDefault];
  //[self.imageView.imageLoader setImageSource:@"GenericFolderIcon.icns"];
  self.imageView.image = [[NSWorkspace sharedWorkspace] iconForFileType:NSFileTypeForHFSTypeCode(kGenericFolderIcon)];
  [self setNeedsLayout];
}

- (void)setBackgroundStyle:(NSBackgroundStyle)backgroundStyle {
  id<KBAppearance> appearance = (backgroundStyle == NSBackgroundStyleDark ? KBAppearance.darkAppearance : KBAppearance.lightAppearance);
  [self.nameLabel setFont:appearance.textFont color:appearance.textColor];
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