//
//  KBImageLabel.h
//  Keybase
//
//  Created by Gabriel on 4/30/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>

typedef NS_ENUM (NSInteger, KBImageLabelStyle) {
  KBImageLabelStyleDefault,
  KBImageLabelStyleLarge,
};


@interface KBImageLabel : YOView

@property (readonly) KBImageView *imageView;
@property (readonly) KBLabel *nameLabel;
@property KBImageLabelStyle style;

+ (NSFont *)fontForStyle:(KBImageLabelStyle)style;

@end
