#ifndef CKB_C_STDLIB_STDINT_H_
#define CKB_C_STDLIB_STDINT_H_

#include <entry.h>

#include "internal/types.h"

#define INT8_MIN (-1 - 0x7f)
#define INT16_MIN (-1 - 0x7fff)
#define INT32_MIN (-1 - 0x7fffffff)
#define INT64_MIN (-1 - 0x7fffffffffffffff)

#define INT8_MAX (0x7f)
#define INT16_MAX (0x7fff)
#define INT32_MAX (0x7fffffff)
#define INT64_MAX (0x7fffffffffffffff)

#define UINT8_MAX (0xff)
#define UINT16_MAX (0xffff)
#define UINT32_MAX (0xffffffffu)
#define UINT64_MAX (0xffffffffffffffffu)

#define SIZE_MAX UINT64_MAX

#endif /* CKB_C_STDLIB_STDINT_H_ */
