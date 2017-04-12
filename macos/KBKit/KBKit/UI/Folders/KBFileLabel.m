//
//  KBFolderView.m
//  Keybase
//
//  Created by Gabriel on 3/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBFileLabel.h"

@implementation KBFileLabel

- (void)setFile:(KBFile *)file {
  [self.nameLabel setText:file.name font:[self.class fontForStyle:self.style] color:KBAppearance.currentAppearance.textColor alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  self.imageView.image = file.icon;
  [self setNeedsLayout];
}

@end
