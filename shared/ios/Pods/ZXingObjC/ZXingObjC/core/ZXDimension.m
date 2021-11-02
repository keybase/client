/*
 * Copyright 2013 ZXing authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#import "ZXDimension.h"

@implementation ZXDimension

- (id)initWithWidth:(int)width height:(int)height {
  if (width < 0 || height < 0) {
    [NSException raise:NSInvalidArgumentException format:@"Width and height must not be negative"];
  }

  if (self = [super init]) {
    _width = width;
    _height = height;
  }

  return self;
}

- (BOOL)isEqual:(id)other {
  if ([other isKindOfClass:[ZXDimension class]]) {
    ZXDimension *d = (ZXDimension *)other;
    return self.width == d.width && self.height == d.height;
  }
  return NO;
}

- (NSUInteger)hash {
  return self.width * 32713 + self.height;
}

- (NSString *)description {
  return [NSString stringWithFormat:@"%dx%d", self.width, self.height];
}

@end
