

#import <Foundation/Foundation.h>

@interface KBFSUtils : NSObject

+(NSURL *) copyToTemporary:(NSString *)bin name:(NSString *)name fileType:(NSFileAttributeType)fileType error:(NSError **)error;
+(BOOL) checkFile:(NSString *)linkPath isType:(NSFileAttributeType)fileType;
+(void) checkKeybaseResource:(NSURL *)bin identifier:(NSString *)identifier error:(NSError **)error;

@end
