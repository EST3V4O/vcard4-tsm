// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Assertion, AsymmetricMatchersContaining } from 'vitest'

import { Nag, VCardNagAttributes } from '../errors.js'
import { errorKeys } from '../errorCodes.js'
import {
  scanPropertyOrGroup,
  extractProperty,
  parseParameters,
  parseVCards,
  parseLine,
  PartialVCard,
} from '../parse.js'

interface CustomMatchers<R = unknown> {
  toNagAbout(a: errorKeys): R
  toNagAboutMany(a: errorKeys[]): R
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Assertion<T = any> extends CustomMatchers<T> {}
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

expect.extend({
  toNagAbout(received: unknown, error: errorKeys) {
    const pass =
      Array.isArray(received) &&
      received.length === 1 &&
      'key' in received[0] &&
      received[0].key === error
    if (pass) {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} not to nag about ${error}`,
        pass: true,
      }
    } else {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} to nag about ${error}`,
        pass: false,
      }
    }
  },
  toNagAboutMany(received: unknown, errors: errorKeys[]) {
    let pass: boolean
    if (Array.isArray(received)) {
      const r = received
        .map((v) => {
          if ('key' in v) {
            return v.key
          } else {
            return undefined
          }
        })
        .sort()
      const e = errors.sort()
      pass = r === e
    } else {
      pass = false
    }
    if (pass) {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} not to nag about ${errors}`,
        pass: true,
      }
    } else {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} to nag about ${errors}`,
        pass: false,
      }
    }
  },
})

describe('Property name parsing', () => {
  it('should parse basic name', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(scanPropertyOrGroup('ADR:x', 0, nags)).toStrictEqual({
      name: 'ADR',
      end: 3,
    })
    expect(nags).toStrictEqual([])
  })
  it('should parse basic name with properties', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(scanPropertyOrGroup('ADR;x=y:z', 0, nags)).toStrictEqual({
      name: 'ADR',
      end: 3,
    })
    expect(nags).toStrictEqual([])
  })
  it('should now also accept property starting with a dash', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(scanPropertyOrGroup('-ADR;x=y:z', 0, nags)).toStrictEqual({
      name: '_ADR',
      end: 4,
    })
    expect(nags).toStrictEqual([])
  })
  it('should allow dash inside property name', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(scanPropertyOrGroup('X-ABUID:z', 0, nags)).toStrictEqual({
      name: 'X_ABUID',
      end: 7,
    })
    expect(nags).toStrictEqual([])
  })
  it('should allow digits inside property name', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(scanPropertyOrGroup('X-ABUID9:z', 0, nags)).toStrictEqual({
      name: 'X_ABUID9',
      end: 8,
    })
    expect(nags).toStrictEqual([])
  })
  it('should work inside the string', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(scanPropertyOrGroup('-X-ABUID9:z', 1, nags)).toStrictEqual({
      name: 'X_ABUID9',
      end: 9,
    })
    expect(nags).toStrictEqual([])
  })
  it('should detect empty properties', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(scanPropertyOrGroup(':z', 0, nags)).toStrictEqual(null)
    expect(nags).toNagAbout('PROP_NAME_EMPTY')
  })
  it('should detect properties ended by EOF', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(scanPropertyOrGroup('ABC', 0, nags)).toStrictEqual(null)
    expect(nags).toNagAbout('PROP_NAME_EOL')
  })
  it('should complain about empty property names', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(scanPropertyOrGroup(':x', 0, nags)).toStrictEqual(null)
    expect(nags).toNagAbout('PROP_NAME_EMPTY')
  })
})

describe('Property/group extraction', () => {
  it('should parse basic name', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(extractProperty('ADR:x', nags)).toStrictEqual({
      property: 'ADR',
      end: 3,
    })
    expect(nags).toStrictEqual([])
  })
  it('should parse basic name with properties', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(extractProperty('ADR;x=y:z', nags)).toStrictEqual({
      property: 'ADR',
      end: 3,
    })
    expect(nags).toStrictEqual([])
  })
  it('should now also allow properties starting with a dash', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(extractProperty('-ADR;x=y:z', nags)).toStrictEqual({
      property: '_ADR',
      end: 4,
    })
    expect(nags).toStrictEqual([])
  })
  it('should allow dash inside property name', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(extractProperty('X-ABUID:z', nags)).toStrictEqual({
      property: 'X_ABUID',
      end: 7,
    })
    expect(nags).toStrictEqual([])
  })
  it('should allow digits inside property name', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(extractProperty('X-ABUID9:z', nags)).toStrictEqual({
      property: 'X_ABUID9',
      end: 8,
    })
    expect(nags).toStrictEqual([])
  })
  it('should parse basic groups', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(extractProperty('A.ADR:x', nags)).toStrictEqual({
      group: 'A',
      property: 'ADR',
      end: 5,
    })
    expect(nags).toStrictEqual([])
  })

  it('should parse numeric groups', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(extractProperty('9.ADR:x', nags)).toStrictEqual({
      group: '9',
      property: 'ADR',
      end: 5,
    })
    expect(nags).toStrictEqual([])
  })
  it('should now also allow dash-starting groups', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(extractProperty('-9.ADR:x', nags)).toStrictEqual({
      group: '_9',
      property: 'ADR',
      end: 6,
    })
    expect(nags).toStrictEqual([])
  })
  it('should now also allow dash-starting grouped properties', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(extractProperty('9.-ADR:x', nags)).toStrictEqual({
      group: '9',
      property: '_ADR',
      end: 6,
    })
    expect(nags).toStrictEqual([])
  })
  it('should nag on empty property', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(extractProperty(':x', nags)).toStrictEqual(null)
    expect(nags).toNagAbout('PROP_NAME_EMPTY')
  })
  it('should nag on empty group name', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(extractProperty('.ADR:x', nags)).toStrictEqual(null)
    expect(nags).toNagAbout('PROP_NAME_EMPTY')
  })
  it('should nag on empty grouped property', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(extractProperty('9.:x', nags)).toStrictEqual(null)
    expect(nags).toNagAbout('PROP_NAME_EMPTY')
  })
})

describe('x parameter parsing', () => {
  it('should handle x key/values', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;KEY=value:x', 1, nags, 'X')).toStrictEqual({
      parameters: { x: { KEY: ['value'] } },
      end: 11,
    })
    expect(nags).toStrictEqual([])
  })
  it('should handle raw x key/values', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;KEY=value,v2:x', 1, nags, 'X')).toStrictEqual({
      parameters: { x: { KEY: ['value,v2'] } },
      end: 14,
    })
    expect(nags).toStrictEqual([])
  })
  it('should handle duplicate x key/values', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;KEY=value;KEY=v2:x', 1, nags, 'X')).toStrictEqual(
      {
        parameters: { x: { KEY: ['value', 'v2'] } },
        end: 18,
      },
    )
    expect(nags).toStrictEqual([])
  })
  it('should upcase keys', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;key=value:x', 1, nags, 'X')).toStrictEqual({
      parameters: { x: { KEY: ['value'] } },
      end: 11,
    })
    expect(nags).toStrictEqual([])
  })
  it('should handle empty values', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;K1=;K2=:x', 1, nags, 'X')).toStrictEqual({
      parameters: { x: { K1: [''], K2: [''] } },
      end: 9,
    })
    expect(nags).toStrictEqual([])
  })
})

describe('String parameter parsing', () => {
  it('should handle string key/values', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;LANGUAGE=de:x', 1, nags, 'X')).toStrictEqual({
      parameters: { LANGUAGE: 'de' },
      end: 13,
    })
    expect(nags).toStrictEqual([])
  })

  it('should upcase keys', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;language=de:x', 1, nags, 'X')).toStrictEqual({
      parameters: { LANGUAGE: 'de' },
      end: 13,
    })
    expect(nags).toStrictEqual([])
  })
  it('should complain on duplicate keys', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(
      parseParameters('x;language=de;LANGUAGE=en:x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { LANGUAGE: 'en' },
      end: 25,
    })
    expect(nags).toNagAbout('PARAM_DUPLICATE')
  })
  it('should handle empty values', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;LANGUAGE=:x', 1, nags, 'X')).toStrictEqual({
      parameters: { LANGUAGE: '' },
      end: 11,
    })
    expect(nags).toStrictEqual([])
  })
  it('should handle newline escapes', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;LANGUAGE=v1\\nv2:x', 1, nags, 'X')).toStrictEqual(
      {
        parameters: { LANGUAGE: 'v1\nv2' },
        end: 17,
      },
    )
    expect(nags).toStrictEqual([])
  })
  it('should handle escaped commas', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;LANGUAGE=v1\\,v2:x', 1, nags, 'X')).toStrictEqual(
      {
        parameters: { LANGUAGE: 'v1,v2' },
        end: 17,
      },
    )
    expect(nags).toStrictEqual([])
  })
  it('should handle escaped semicolons', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;LANGUAGE=v1\\;v2:x', 1, nags, 'X')).toStrictEqual(
      {
        parameters: { LANGUAGE: 'v1;v2' },
        end: 17,
      },
    )
    expect(nags).toStrictEqual([])
  })
  it('should handle escaped backslashes', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(
      parseParameters('x;LANGUAGE=v1\\\\v2:x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { LANGUAGE: 'v1\\v2' },
      end: 17,
    })
    expect(nags).toStrictEqual([])
  })
  it('should handle unnecessarily escaped other chars', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;LANGUAGE=v1\\+v2:x', 1, nags, 'X')).toStrictEqual(
      {
        parameters: { LANGUAGE: 'v1+v2' },
        end: 17,
      },
    )
    expect(nags).toStrictEqual([])
  })
  it('should handle (and detect) unescaped commas after backslashes', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(
      parseParameters('x;LANGUAGE=v1\\\\,v2:x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { LANGUAGE: 'v1\\,v2' },
      end: 18,
    })
    expect(nags).toNagAbout('PARAM_UNESCAPED_COMMA')
  })
  it('should handle quoted values', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;LANGUAGE="abc":x', 1, nags, 'X')).toStrictEqual({
      parameters: { LANGUAGE: 'abc' },
      end: 16,
    })
    expect(nags).toStrictEqual([])
  })
  it('should handle special chars in quoted values', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(
      parseParameters('x;LANGUAGE="a,b;c:d":x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { LANGUAGE: 'a,b;c:d' },
      end: 20,
    })
    expect(nags).toStrictEqual([
      {
        attributes: {
          line: 'x;LANGUAGE="a,b;c:d":x',
          parameter: 'LANGUAGE',
          property: 'X',
        },
        description: 'Unescaped comma in parameter value',
        isError: false,
        key: 'PARAM_UNESCAPED_COMMA',
      },
    ])
  })
  it('should handle newlines in quoted values', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(
      parseParameters('x;LANGUAGE="A^nB\\^nC":x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { LANGUAGE: 'A\nB\\\nC' },
      end: 21,
    })
    expect(nags).toStrictEqual([
      {
        attributes: {
          line: 'x;LANGUAGE="A^nB\\^nC":x',
          parameter: 'LANGUAGE',
          property: 'X',
        },
        description: 'Backslash found in parameter value',
        isError: false,
        key: 'PARAM_BAD_BACKSLASH',
      },
    ])
  })
  it('should nag about backslashes in quoted values', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(
      parseParameters('x;LANGUAGE="a\\,b;c:d\\":x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { LANGUAGE: 'a\\,b;c:d\\' },
      end: 22,
    })
    expect(nags).toStrictEqual([
      {
        attributes: {
          line: 'x;LANGUAGE="a\\,b;c:d\\":x',
          parameter: 'LANGUAGE',
          property: 'X',
        },
        description: 'Backslash found in parameter value',
        isError: false,
        key: 'PARAM_BAD_BACKSLASH',
      },
      {
        attributes: {
          line: 'x;LANGUAGE="a\\,b;c:d\\":x',
          parameter: 'LANGUAGE',
          property: 'X',
        },
        description: 'Unescaped comma in parameter value',
        isError: false,
        key: 'PARAM_UNESCAPED_COMMA',
      },
    ])
  })
})

describe('Multi-string parameter parsing', () => {
  it('should handle multiple values', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;TYPE=v1,v2:x', 1, nags, 'X')).toStrictEqual({
      parameters: { TYPE: ['v1', 'v2'] },
      end: 12,
    })
    expect(nags).toStrictEqual([])
  })
  it('should handle multiple keys', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(
      parseParameters('x;LANGUAGE=de;GEO=here:x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { LANGUAGE: 'de', GEO: 'here' },
      end: 22,
    })
    expect(nags).toStrictEqual([])
  })
  it('should handle multiple keys and values', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(
      parseParameters('x;TYPE=v1,v2;TYPE=v3,v4:x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { TYPE: ['v1', 'v2', 'v3', 'v4'] },
      end: 23,
    })
    expect(nags).toStrictEqual([])
  })
  it('should handle newline escapes', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;TYPE=v1\\nv2:x', 1, nags, 'X')).toStrictEqual({
      parameters: { TYPE: ['v1\nv2'] },
      end: 13,
    })
    expect(nags).toStrictEqual([])
  })
  it('should handle escaped commas', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;TYPE=v1\\,v2:x', 1, nags, 'X')).toStrictEqual({
      parameters: { TYPE: ['v1,v2'] },
      end: 13,
    })
    expect(nags).toStrictEqual([])
  })
  it('should handle escaped semicolons', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;TYPE=v1\\;v2:x', 1, nags, 'X')).toStrictEqual({
      parameters: { TYPE: ['v1;v2'] },
      end: 13,
    })
    expect(nags).toStrictEqual([])
  })
  it('should handle escaped backslashes', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;type=v1\\\\v2:x', 1, nags, 'X')).toStrictEqual({
      parameters: { TYPE: ['v1\\v2'] },
      end: 13,
    })
    expect(nags).toStrictEqual([])
  })
  it('should handle unnecessarily escaped other chars', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;TYPE=v1\\+v2:x', 1, nags, 'X')).toStrictEqual({
      parameters: { TYPE: ['v1+v2'] },
      end: 13,
    })
    expect(nags).toStrictEqual([])
  })

  it('should handle unescaped commas after backslashes', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;TYPE=v1\\\\,v2:x', 1, nags, 'X')).toStrictEqual({
      parameters: { TYPE: ['v1\\', 'v2'] },
      end: 14,
    })
    expect(nags).toStrictEqual([])
  })
  it('should handle complicated escapes', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(
      parseParameters(
        'x;TYPE=v1\\;\\n\\,,\\v2\\\\,;TYPE=\\:\\n\\\\n\\\\\\n:x',
        1,
        nags,
        'X',
      ),
    ).toStrictEqual({
      parameters: { TYPE: ['v1;\n,', 'v2\\', '', ':\n\\n\\\n'] },
      end: 39,
    })
    expect(nags).toStrictEqual([])
  })
  it('should handle quoted values', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;TYPE="abc":x', 1, nags, 'X')).toStrictEqual({
      parameters: { TYPE: ['abc'] },
      end: 12,
    })
    expect(nags).toStrictEqual([])
  })
  it('should handle special chars in quoted values', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(parseParameters('x;TYPE="a,b;c:d":x', 1, nags, 'X')).toStrictEqual({
      parameters: { TYPE: ['a,b;c:d'] },
      end: 16,
    })
    expect(nags).toStrictEqual([
      {
        attributes: {
          line: 'x;TYPE="a,b;c:d":x',
          parameter: 'TYPE',
          property: 'X',
        },
        description: 'Unescaped comma in parameter value',
        isError: false,
        key: 'PARAM_UNESCAPED_COMMA',
      },
    ])
  })
  it('should handle newlines in quoted values', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(
      parseParameters('x;TYPE="A^n\\nB\\^nC":x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { TYPE: ['A\n\\nB\\\nC'] },
      end: 19,
    })
    expect(nags).toStrictEqual([
      {
        attributes: {
          line: 'x;TYPE="A^n\\nB\\^nC":x',
          parameter: 'TYPE',
          property: 'X',
        },
        description: 'Backslash found in parameter value',
        isError: false,
        key: 'PARAM_BAD_BACKSLASH',
      },
    ])
  })
  it('should ignore most other backslashes in quoted values', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(
      parseParameters('x;TYPE="a\\,b;c:d\\":x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { TYPE: ['a\\,b;c:d\\'] },
      end: 18,
    })
    expect(nags).toStrictEqual([
      {
        attributes: {
          line: 'x;TYPE="a\\,b;c:d\\":x',
          parameter: 'TYPE',
          property: 'X',
        },
        description: 'Backslash found in parameter value',
        isError: false,
        key: 'PARAM_BAD_BACKSLASH',
      },
      {
        attributes: {
          line: 'x;TYPE="a\\,b;c:d\\":x',
          parameter: 'TYPE',
          property: 'X',
        },
        description: 'Unescaped comma in parameter value',
        isError: false,
        key: 'PARAM_UNESCAPED_COMMA',
      },
    ])
  })
  it('should handle multiple quoted values', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(
      parseParameters('x;TYPE="a b c","d e f":x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { TYPE: ['a b c', 'd e f'] },
      end: 22,
    })
    expect(nags).toStrictEqual([])
  })
  it('should handle mixed values', () => {
    const nags: Nag<VCardNagAttributes>[] = []
    expect(
      parseParameters('x;TYPE="a b c",d e f,"g h i":x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { TYPE: ['a b c', 'd e f', 'g h i'] },
      end: 28,
    })
    expect(nags).toStrictEqual([])
  })
})

describe('Line parsing', () => {
  it('should nag on empty property', () => {
    const partialVCard: PartialVCard = { nags: [], unparseable: [] }
    parseLine(partialVCard, ':x')
    expect(partialVCard).toStrictEqual({
      nags: [
        {
          key: 'PROP_NAME_EMPTY',
          description: 'Empty property or group name',
          isError: true,
          attributes: { line: ':x', property: '' },
        },
      ],
      unparseable: [':x'],
    })
  })
  it('should nag on bad parameter', () => {
    const partialVCard: PartialVCard = { nags: [], unparseable: [] }
    parseLine(partialVCard, 'ADR;y:x')
    expect(partialVCard).toStrictEqual({
      nags: [
        {
          key: 'PARAM_MISSING_EQUALS',
          description: 'Missing equals sign after parameter name',
          isError: true,
          attributes: { line: 'ADR;y:x', property: 'ADR', parameter: 'Y' },
        },
      ],
      unparseable: ['ADR;y:x'],
    })
  })
  it('should nag on bad value', () => {
    const partialVCard: PartialVCard = { nags: [], unparseable: [] }
    parseLine(partialVCard, 'PHOTO:data:image/jpeg;base64,/9j/')
    expect(partialVCard).toStrictEqual({
      PHOTO: [
        {
          parameters: {},
          value: 'data:image/jpeg;base64,/9j/',
        },
      ],
      nags: [
        {
          key: 'VALUE_UNESCAPED_COMMA',
          description: 'Unescaped comma in value',
          isError: false,
          attributes: {
            line: 'PHOTO:data:image/jpeg;base64,…',
            property: 'PHOTO',
          },
        },
      ],
      unparseable: [],
    })
  })
  it('should nag on unterminated parameter value', () => {
    const partialVCard: PartialVCard = { nags: [], unparseable: [] }
    parseLine(partialVCard, 'tel;cc=":')
    expect(partialVCard).toStrictEqual({
      nags: [
        {
          key: 'PARAM_UNCLOSED_QUOTE',
          description: 'Quoted parameter missing closing quote',
          isError: true,
          attributes: { line: 'tel;cc=":', property: 'TEL', parameter: 'CC' },
        },
      ],
      unparseable: ['tel;cc=":'],
    })
  })
})

describe('vCard parsing', () => {
  it('should put things together', () => {
    expect(
      parseVCards(
        'BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Marcel Wald\r\n vogel\r\nADR;type=work:;;Oberstadt 8;Stein am Rhein;;8260;Switzerland\r\nEND:VCARD\r\n',
        true,
      ),
    ).toStrictEqual({
      vCards: [
        {
          BEGIN: { value: 'VCARD' },
          VERSION: { value: '4.0' },
          FN: [{ value: 'Marcel Waldvogel' }],
          ADR: [
            {
              parameters: { TYPE: ['work'] },
              value: {
                postOfficeBox: [''],
                extendedAddress: [''],
                streetAddress: ['Oberstadt 8'],
                locality: ['Stein am Rhein'],
                region: [''],
                postalCode: ['8260'],
                countryName: ['Switzerland'],
              },
            },
          ],
          END: { value: 'VCARD' },
          hasErrors: false,
        },
      ],
    })
  })

  it('should nag about underspecified cards', () => {
    expect(parseVCards('END:VCARD', true)).toStrictEqual({
      vCards: [
        {
          BEGIN: { value: 'VCARD' },
          END: { value: 'VCARD' },
          FN: [{ value: '' }],
          VERSION: { value: '4.0' },
          hasErrors: true,
          nags: [
            {
              key: 'VCARD_NOT_BEGIN',
              description: 'vCard did not start with BEGIN line',
              isError: true,
              attributes: { property: 'BEGIN' },
            },
            {
              key: 'VCARD_BAD_TYPE',
              description: 'Not a vCard',
              isError: true,
              attributes: { property: 'BEGIN' },
            },
            {
              key: 'VCARD_MISSING_PROP',
              description: 'Missing required property',
              isError: true,
              attributes: { property: 'BEGIN' },
            },
            {
              key: 'VCARD_MISSING_PROP',
              description: 'Missing required property',
              isError: true,
              attributes: { property: 'VERSION' },
            },
            {
              key: 'VCARD_MISSING_PROP',
              description: 'Missing required property',
              isError: true,
              attributes: { property: 'FN' },
            },
          ],
        },
      ],
    })
  })
  it('should nag about underspecified cards when discarding', () => {
    expect(parseVCards('END:VCARD', false)).toStrictEqual({
      nags: [
        {
          key: 'VCARD_NOT_BEGIN',
          description: 'vCard did not start with BEGIN line',
          isError: true,
        },
      ],
    })
  })

  it('should somehow handle bogus cards', () => {
    expect(
      parseVCards('BEGIN:VCALENDAR\r\nVERSION:5.0\r\nFN:\r\n \r\n', true),
    ).toStrictEqual({
      vCards: [
        {
          BEGIN: { value: 'VCALENDAR' },
          VERSION: { value: '5.0' },
          FN: [{ value: '' }],
          END: { value: 'VCARD' },
          hasErrors: true,
          nags: [
            {
              key: 'VCARD_BAD_TYPE',
              description: 'Not a vCard',
              isError: true,
              attributes: { property: 'BEGIN' },
            },
            {
              key: 'VCARD_BAD_TYPE',
              description: 'Not a vCard',
              isError: true,
              attributes: { property: 'END' },
            },
            {
              key: 'VALUE_INVALID',
              description: 'Invalid property value',
              isError: true,
              attributes: { line: 'BEGIN:VCALENDAR', property: 'BEGIN' },
            },
            {
              key: 'VALUE_INVALID',
              description: 'Invalid property value',
              isError: true,
              attributes: { line: 'VERSION:5.0', property: 'VERSION' },
            },
            {
              key: 'VCARD_MISSING_PROP',
              description: 'Missing required property',
              isError: true,
              attributes: { property: 'END' },
            },
          ],
        },
      ],
    })
  })

  it('should ignore bogus cards, if told so', () => {
    expect(
      parseVCards('BEGIN:VCALENDAR\r\nVERSION:5.0\r\nFN:\r\n \r\n', false),
    ).toStrictEqual({
      nags: [
        {
          key: 'VCARD_BAD_TYPE',
          description: 'Not a vCard',
          isError: true,
        },
      ],
    })
  })

  it('should handle multiple values', () => {
    expect(
      parseVCards(
        "BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Marcel Waldvogel\r\nFN;LANGUAGE=fr:Marcel l'Oiseau de la Forêt\r\nTZ:Europe/Berlin\r\nTZ:Europe/Zurich\r\nEND:VCARD\r\n",
        true,
      ),
    ).toStrictEqual({
      vCards: [
        {
          BEGIN: { value: 'VCARD' },
          VERSION: { value: '4.0' },
          FN: [
            {
              value: 'Marcel Waldvogel',
            },
            {
              value: "Marcel l'Oiseau de la Forêt",
              parameters: { LANGUAGE: 'fr' },
            },
          ],
          TZ: [{ value: 'Europe/Berlin' }, { value: 'Europe/Zurich' }],
          END: { value: 'VCARD' },
          hasErrors: false,
        },
      ],
    })
  })
  it('should nag about duplicate properties', () => {
    expect(
      parseVCards(
        'BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Marcel Waldvogel\r\nUID:123\r\nUID:456\r\nEND:VCARD\r\n',
        true,
      ),
    ).toStrictEqual({
      vCards: [
        {
          BEGIN: { value: 'VCARD' },
          VERSION: { value: '4.0' },
          FN: [{ value: 'Marcel Waldvogel' }],
          UID: { value: '123' },
          END: { value: 'VCARD' },
          hasErrors: true,
          nags: [
            {
              key: 'PROP_DUPLICATE',
              description: 'Illegal duplicate property',
              isError: true,
              attributes: { line: 'UID:456', property: 'UID' },
            },
          ],
          unparseable: ['UID:456'],
        },
      ],
    })
  })
  it('should nag about plain LF', () => {
    // Not conformant with the RFC, but I believe we should accept it
    expect(
      parseVCards(
        'BEGIN:VCARD\nVERSION:4.0\nFN:Marcel Waldvogel\nEND:VCARD\n',
        true,
      ),
    ).toStrictEqual({
      vCards: [
        {
          BEGIN: { value: 'VCARD' },
          VERSION: { value: '4.0' },
          FN: [{ value: 'Marcel Waldvogel' }],
          END: { value: 'VCARD' },
          hasErrors: false,
        },
      ],
      nags: [
        {
          key: 'FILE_CRLF',
          description: 'Lines ending in bare linefeeds instead of CR+LF',
          isError: false,
        },
      ],
    })
  })
  it('should accept missing terminal CRLF', () => {
    expect(
      parseVCards(
        'BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Marcel Waldvogel\r\nEND:VCARD',
        true,
      ),
    ).toStrictEqual({
      vCards: [
        {
          BEGIN: { value: 'VCARD' },
          VERSION: { value: '4.0' },
          FN: [{ value: 'Marcel Waldvogel' }],
          END: { value: 'VCARD' },
          hasErrors: false,
        },
      ],
    })
  })

  it('should accept additional leading CRLF', () => {
    // Not conformant with the RFC, but I believe we should accept it
    expect(
      parseVCards(
        '\r\nBEGIN:VCARD\r\nVERSION:4.0\r\nFN:Marcel Waldvogel\r\nEND:VCARD',
        true,
      ),
    ).toStrictEqual({
      vCards: [
        {
          BEGIN: { value: 'VCARD' },
          VERSION: { value: '4.0' },
          FN: [{ value: 'Marcel Waldvogel' }],
          END: { value: 'VCARD' },
          hasErrors: false,
        },
      ],
    })
  })
  it('should handle multiple vCards', () => {
    expect(
      parseVCards(
        'BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Marcel Waldvogel\r\nEND:VCARD\r\nBEGIN:VCARD\r\nVERSION:4.0\r\nFN:Jane Doe\r\nEND:VCARD\r\n',
        true,
      ),
    ).toStrictEqual({
      vCards: [
        {
          BEGIN: { value: 'VCARD' },
          VERSION: { value: '4.0' },
          FN: [{ value: 'Marcel Waldvogel' }],
          END: { value: 'VCARD' },
          hasErrors: false,
        },
        {
          BEGIN: { value: 'VCARD' },
          VERSION: { value: '4.0' },
          FN: [{ value: 'Jane Doe' }],
          END: { value: 'VCARD' },
          hasErrors: false,
        },
      ],
    })
  })
  it('should handle empty lines', () => {
    // Not conformant with the RFC, but I believe we should accept it
    expect(
      parseVCards(
        'BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Marcel Waldvogel\r\n\r\nEND:VCARD\r\nBEGIN:VCARD\r\n\r\nVERSION:4.0\r\nFN:Jane Doe\r\nEND:VCARD\r\n',
        true,
      ),
    ).toStrictEqual({
      vCards: [
        {
          BEGIN: { value: 'VCARD' },
          VERSION: { value: '4.0' },
          FN: [{ value: 'Marcel Waldvogel' }],
          END: { value: 'VCARD' },
          hasErrors: false,
        },
        {
          BEGIN: { value: 'VCARD' },
          VERSION: { value: '4.0' },
          FN: [{ value: 'Jane Doe' }],
          END: { value: 'VCARD' },
          hasErrors: false,
        },
      ],
    })
  })
  it('should handle x properties', () => {
    expect(
      parseVCards(
        'BEGIN:VCARD\r\nVERSION:4.0\r\nFN;SORT-AS=MW:Marcel Waldvogel\r\nX-ABUID:999\r\nX-TEST:1\r\nX-TEST;LANGUAGE=de:2\r\nEND:VCARD',
        true,
      ),
    ).toStrictEqual({
      vCards: [
        {
          BEGIN: { value: 'VCARD' },
          VERSION: { value: '4.0' },
          FN: [{ parameters: { SORT_AS: ['MW'] }, value: 'Marcel Waldvogel' }],
          END: { value: 'VCARD' },
          x: {
            X_ABUID: [{ value: '999' }],
            X_TEST: [
              { value: '1' },
              { parameters: { LANGUAGE: 'de' }, value: '2' },
            ],
          },
          hasErrors: false,
        },
      ],
    })
  })
  it('should nag about commas in single-string parameter values', () => {
    expect(
      parseVCards(
        'BEGIN:VCARD\r\nVERSION:4.0\r\nFN;LANGUAGE=de,en:Marcel Waldvogel\r\nEND:VCARD',
        true,
      ),
    ).toStrictEqual({
      vCards: [
        {
          BEGIN: { value: 'VCARD' },
          VERSION: { value: '4.0' },
          FN: [
            { parameters: { LANGUAGE: 'de,en' }, value: 'Marcel Waldvogel' },
          ],
          END: { value: 'VCARD' },
          hasErrors: false,
          nags: [
            {
              key: 'PARAM_UNESCAPED_COMMA',
              description: 'Unescaped comma in parameter value',
              isError: false,
              attributes: {
                line: 'FN;LANGUAGE=de,en:Marcel Wald…',
                parameter: 'LANGUAGE',
                property: 'FN',
              },
            },
          ],
        },
      ],
    })
  })
  it('should nag about unclosed parameter quotes in multi-strings', () => {
    expect(
      parseVCards(
        'BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Marcel Waldvogel\r\nUID;TYPE="de:123\r\nEND:VCARD',
        true,
      ),
    ).toStrictEqual({
      vCards: [
        {
          BEGIN: { value: 'VCARD' },
          VERSION: { value: '4.0' },
          FN: [{ value: 'Marcel Waldvogel' }],
          END: { value: 'VCARD' },
          hasErrors: true,
          nags: [
            {
              key: 'PARAM_UNCLOSED_QUOTE',
              description: 'Quoted parameter missing closing quote',
              isError: true,
              attributes: {
                line: 'UID;TYPE="de:123',
                parameter: 'TYPE',
                property: 'UID',
              },
            },
          ],
          unparseable: ['UID;TYPE="de:123'],
        },
      ],
    })
  })
  it('should handle number parameters', () => {
    expect(
      parseVCards(
        'BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Marcel Waldvogel\r\nEMAIL;PREF=100:a@b.c\r\nEND:VCARD',
        true,
      ),
    ).toStrictEqual({
      vCards: [
        {
          BEGIN: { value: 'VCARD' },
          VERSION: { value: '4.0' },
          FN: [{ value: 'Marcel Waldvogel' }],
          EMAIL: [{ parameters: { PREF: 100 }, value: 'a@b.c' }],
          END: { value: 'VCARD' },
          hasErrors: false,
        },
      ],
    })
  })
  it('should nag about invalid number parameters', () => {
    expect(
      parseVCards(
        'BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Marcel Waldvogel\r\nEMAIL;PREF=yes:a@b.c\r\nEND:VCARD',
        true,
      ),
    ).toStrictEqual({
      vCards: [
        {
          BEGIN: { value: 'VCARD' },
          VERSION: { value: '4.0' },
          FN: [{ value: 'Marcel Waldvogel' }],
          EMAIL: [{ value: 'a@b.c' }],
          END: { value: 'VCARD' },
          hasErrors: true,
          nags: [
            {
              key: 'PARAM_INVALID_NUMBER',
              description: 'Invalid number',
              isError: true,
              attributes: {
                line: 'EMAIL;PREF=yes:a@b.c',
                parameter: 'PREF',
                property: 'EMAIL',
              },
            },
          ],
        },
      ],
    })
  })
  it('should nag about quoted multiple strings', () => {
    expect(
      parseVCards(
        'BEGIN:VCARD\r\nVERSION:4.0\r\nFN:Marcel Waldvogel\r\nEMAIL;PREF=yes:a@b.c\r\nEND:VCARD',
        true,
      ),
    ).toStrictEqual({
      vCards: [
        {
          BEGIN: { value: 'VCARD' },
          VERSION: { value: '4.0' },
          FN: [{ value: 'Marcel Waldvogel' }],
          EMAIL: [{ value: 'a@b.c' }],
          END: { value: 'VCARD' },
          hasErrors: true,
          nags: [
            {
              key: 'PARAM_INVALID_NUMBER',
              description: 'Invalid number',
              isError: true,
              attributes: {
                line: 'EMAIL;PREF=yes:a@b.c',
                parameter: 'PREF',
                property: 'EMAIL',
              },
            },
          ],
        },
      ],
    })
  })
})
