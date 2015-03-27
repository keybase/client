//
//  KBFileIconLabel.h
//  Keybase
//
//  Created by Gabriel on 3/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBFile.h"

@interface KBFileIcon : YOView

@property KBImageView *imageView;
@property KBLabel *nameLabel;
@property CGFloat iconHeight;

@property (nonatomic) KBFile *file;

@end
