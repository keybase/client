

#import <Foundation/Foundation.h>

NSURL *copyToTemporary(NSString *bin, NSString *name, NSFileAttributeType fileType, NSError **error);
BOOL checkFileIsType(NSString * linkPath, NSFileAttributeType fileType);
void checkKeybaseResource(NSURL *bin, NSString *identifier, NSError **error);
