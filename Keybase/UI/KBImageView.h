//
//  KBImageView.h
//  Keybase
//
//  Created by Gabriel on 1/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

@interface KBImageView : NSImageView

@property (nonatomic) NSString *URLString;
@property float roundedRatio;

- (void)setImageSource:(NSString *)imageSource;

@end
