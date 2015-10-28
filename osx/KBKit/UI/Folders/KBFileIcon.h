//
//  KBFileIconLabel.h
//  Keybase
//
//  Created by Gabriel on 3/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>
#import "KBFile.h"

@interface KBFileIcon : YOView

@property CGFloat iconHeight;
@property NSFont *font;

@property (nonatomic) KBFile *file;

@end
