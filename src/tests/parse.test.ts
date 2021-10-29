import { Nag, VCardNagAttributes } from '../errors';
import { errorKeys } from '../errorCodes';
import {
  scanPropertyOrGroup,
  extractProperty,
  parseParameters,
  parseVCards,
} from '../parse';

expect.extend({
  toNagAbout(received, error: errorKeys) {
    const pass =
      Array.isArray(received) &&
      received.length == 1 &&
      'key' in received[0] &&
      received[0].key === error;
    if (pass) {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} not to nag about ${error}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} to nag about ${error}`,
        pass: false,
      };
    }
  },
});
expect.extend({
  toNagAboutMany(received, errors: errorKeys[]) {
    let pass: boolean;
    if (Array.isArray(received)) {
      const r = received
        .map((v) => {
          if ('key' in v) {
            return v.key;
          } else {
            return undefined;
          }
        })
        .sort();
      const e = errors.sort();
      pass = r === e;
    } else {
      pass = false;
    }
    if (pass) {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} not to nag about ${errors}`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${JSON.stringify(received)} to nag about ${errors}`,
        pass: false,
      };
    }
  },
});
declare global {
  namespace jest {
    interface Matchers<R> {
      toNagAbout(a: errorKeys): R;
      toNagAboutMany(a: errorKeys[]): R;
    }
  }
}

describe('Property name parsing', () => {
  it('should parse basic name', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(scanPropertyOrGroup('ADR:x', 0, nags)).toStrictEqual({
      name: 'ADR',
      end: 3,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should parse basic name with properties', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(scanPropertyOrGroup('ADR;x=y:z', 0, nags)).toStrictEqual({
      name: 'ADR',
      end: 3,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should now also accept property starting with a dash', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(scanPropertyOrGroup('-ADR;x=y:z', 0, nags)).toStrictEqual({
      name: '-ADR',
      end: 4,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should allow dash inside property name', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(scanPropertyOrGroup('X-ABUID:z', 0, nags)).toStrictEqual({
      name: 'X-ABUID',
      end: 7,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should allow digits inside property name', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(scanPropertyOrGroup('X-ABUID9:z', 0, nags)).toStrictEqual({
      name: 'X-ABUID9',
      end: 8,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should work inside the string', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(scanPropertyOrGroup('-X-ABUID9:z', 1, nags)).toStrictEqual({
      name: 'X-ABUID9',
      end: 9,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should detect empty properties', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(scanPropertyOrGroup(':z', 0, nags)).toStrictEqual(null);
    expect(nags).toNagAbout('PROP_NAME_EMPTY');
  });
  it('should detect properties ended by EOF', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(scanPropertyOrGroup('ABC', 0, nags)).toStrictEqual(null);
    expect(nags).toNagAbout('PROP_NAME_EOL');
  });
});

describe('Property/group extraction', () => {
  it('should parse basic name', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(extractProperty('ADR:x', nags)).toStrictEqual({
      property: 'ADR',
      end: 3,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should parse basic name with properties', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(extractProperty('ADR;x=y:z', nags)).toStrictEqual({
      property: 'ADR',
      end: 3,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should now also allow properties starting with a dash', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(extractProperty('-ADR;x=y:z', nags)).toStrictEqual({
      property: '-ADR',
      end: 4,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should allow dash inside property name', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(extractProperty('X-ABUID:z', nags)).toStrictEqual({
      property: 'X-ABUID',
      end: 7,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should allow digits inside property name', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(extractProperty('X-ABUID9:z', nags)).toStrictEqual({
      property: 'X-ABUID9',
      end: 8,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should parse basic groups', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(extractProperty('A.ADR:x', nags)).toStrictEqual({
      group: 'A',
      property: 'ADR',
      end: 5,
    });
    expect(nags).toStrictEqual([]);
  });

  it('should parse numeric groups', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(extractProperty('9.ADR:x', nags)).toStrictEqual({
      group: '9',
      property: 'ADR',
      end: 5,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should now also allow dash-starting groups', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(extractProperty('-9.ADR:x', nags)).toStrictEqual({
      group: '-9',
      property: 'ADR',
      end: 6,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should now also allow dash-starting grouped properties', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(extractProperty('9.-ADR:x', nags)).toStrictEqual({
      group: '9',
      property: '-ADR',
      end: 6,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should nag on empty property', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(extractProperty(':x', nags)).toStrictEqual(null);
    expect(nags).toNagAbout('PROP_NAME_EMPTY');
  });
  it('should nag on empty group name', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(extractProperty('.ADR:x', nags)).toStrictEqual(null);
    expect(nags).toNagAbout('PROP_NAME_EMPTY');
  });
  it('should nag on empty grouped property', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(extractProperty('9.:x', nags)).toStrictEqual(null);
    expect(nags).toNagAbout('PROP_NAME_EMPTY');
  });
});

describe('Unrecognized parameter parsing', () => {
  it('should handle unrecognized key/values', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;KEY=value:x', 1, nags, 'X')).toStrictEqual({
      parameters: { unrecognized: { KEY: ['value'] } },
      end: 11,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle raw unrecognized key/values', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;KEY=value,v2:x', 1, nags, 'X')).toStrictEqual({
      parameters: { unrecognized: { KEY: ['value,v2'] } },
      end: 14,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle duplicate unrecognized key/values', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;KEY=value;KEY=v2:x', 1, nags, 'X')).toStrictEqual(
      {
        parameters: { unrecognized: { KEY: ['value', 'v2'] } },
        end: 18,
      },
    );
    expect(nags).toStrictEqual([]);
  });
  it('should upcase keys', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;key=value:x', 1, nags, 'X')).toStrictEqual({
      parameters: { unrecognized: { KEY: ['value'] } },
      end: 11,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle empty values', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;K1=;K2=:x', 1, nags, 'X')).toStrictEqual({
      parameters: { unrecognized: { K1: [''], K2: [''] } },
      end: 9,
    });
    expect(nags).toStrictEqual([]);
  });
});

describe('String parameter parsing', () => {
  it('should handle string key/values', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;LANGUAGE=de:x', 1, nags, 'X')).toStrictEqual({
      parameters: { LANGUAGE: 'de' },
      end: 13,
    });
    expect(nags).toStrictEqual([]);
  });

  it('should upcase keys', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;language=de:x', 1, nags, 'X')).toStrictEqual({
      parameters: { LANGUAGE: 'de' },
      end: 13,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should complain on duplicate keys', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(
      parseParameters('x;language=de;LANGUAGE=en:x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { LANGUAGE: 'en' },
      end: 25,
    });
    expect(nags).toNagAbout('PARAM_DUPLICATE');
  });
  it('should handle empty values', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;LANGUAGE=:x', 1, nags, 'X')).toStrictEqual({
      parameters: { LANGUAGE: '' },
      end: 11,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle newline escapes', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;LANGUAGE=v1\\nv2:x', 1, nags, 'X')).toStrictEqual(
      {
        parameters: { LANGUAGE: 'v1\nv2' },
        end: 17,
      },
    );
    expect(nags).toStrictEqual([]);
  });
  it('should handle escaped commas', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;LANGUAGE=v1\\,v2:x', 1, nags, 'X')).toStrictEqual(
      {
        parameters: { LANGUAGE: 'v1,v2' },
        end: 17,
      },
    );
    expect(nags).toStrictEqual([]);
  });
  it('should handle escaped semicolons', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;LANGUAGE=v1\\;v2:x', 1, nags, 'X')).toStrictEqual(
      {
        parameters: { LANGUAGE: 'v1;v2' },
        end: 17,
      },
    );
    expect(nags).toStrictEqual([]);
  });
  it('should handle escaped backslashes', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(
      parseParameters('x;LANGUAGE=v1\\\\v2:x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { LANGUAGE: 'v1\\v2' },
      end: 17,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle unnecessarily escaped other chars', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;LANGUAGE=v1\\+v2:x', 1, nags, 'X')).toStrictEqual(
      {
        parameters: { LANGUAGE: 'v1+v2' },
        end: 17,
      },
    );
    expect(nags).toStrictEqual([]);
  });
  it('should handle (and detect) unescaped commas after backslashes', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(
      parseParameters('x;LANGUAGE=v1\\\\,v2:x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { LANGUAGE: 'v1\\,v2' },
      end: 18,
    });
    expect(nags).toNagAbout('PARAM_UNESCAPED_COMMA');
  });
  it('should handle quoted values', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;LANGUAGE="abc":x', 1, nags, 'X')).toStrictEqual({
      parameters: { LANGUAGE: 'abc' },
      end: 16,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle special chars in quoted values', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(
      parseParameters('x;LANGUAGE="a,b;c:d":x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { LANGUAGE: 'a,b;c:d' },
      end: 20,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle newlines in quoted values', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(
      parseParameters('x;LANGUAGE="A\\nB\\\\nC":x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { LANGUAGE: 'A\nB\\nC' },
      end: 21,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should ignore most other backslashes in quoted values', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(
      parseParameters('x;LANGUAGE="a\\,b;c:d\\":x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { LANGUAGE: 'a,b;c:d' },
      end: 22,
    });
    expect(nags).toStrictEqual([]);
  });
});

describe('Multi-string parameter parsing', () => {
  it('should handle multiple values', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;TYPE=v1,v2:x', 1, nags, 'X')).toStrictEqual({
      parameters: { TYPE: ['v1', 'v2'] },
      end: 12,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle multiple keys', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(
      parseParameters('x;LANGUAGE=de;GEO=here:x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { LANGUAGE: 'de', GEO: 'here' },
      end: 22,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle multiple keys and values', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(
      parseParameters('x;TYPE=v1,v2;TYPE=v3,v4:x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { TYPE: ['v1', 'v2', 'v3', 'v4'] },
      end: 23,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle newline escapes', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;TYPE=v1\\nv2:x', 1, nags, 'X')).toStrictEqual({
      parameters: { TYPE: ['v1\nv2'] },
      end: 13,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle escaped commas', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;TYPE=v1\\,v2:x', 1, nags, 'X')).toStrictEqual({
      parameters: { TYPE: ['v1,v2'] },
      end: 13,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle escaped semicolons', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;TYPE=v1\\;v2:x', 1, nags, 'X')).toStrictEqual({
      parameters: { TYPE: ['v1;v2'] },
      end: 13,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle escaped backslashes', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;type=v1\\\\v2:x', 1, nags, 'X')).toStrictEqual({
      parameters: { TYPE: ['v1\\v2'] },
      end: 13,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle unnecessarily escaped other chars', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;TYPE=v1\\+v2:x', 1, nags, 'X')).toStrictEqual({
      parameters: { TYPE: ['v1+v2'] },
      end: 13,
    });
    expect(nags).toStrictEqual([]);
  });

  it('should handle unescaped commas after backslashes', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;TYPE=v1\\\\,v2:x', 1, nags, 'X')).toStrictEqual({
      parameters: { TYPE: ['v1\\', 'v2'] },
      end: 14,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle complicated escapes', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
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
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle quoted values', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;TYPE="abc":x', 1, nags, 'X')).toStrictEqual({
      parameters: { TYPE: ['abc'] },
      end: 12,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle special chars in quoted values', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(parseParameters('x;TYPE="a,b;c:d":x', 1, nags, 'X')).toStrictEqual({
      parameters: { TYPE: ['a,b;c:d'] },
      end: 16,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle newlines in quoted values', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(
      parseParameters('x;TYPE="A\\nB\\\\nC":x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { TYPE: ['A\nB\\nC'] },
      end: 17,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should ignore most other backslashes in quoted values', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(
      parseParameters('x;TYPE="a\\,b;c:d\\":x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { TYPE: ['a,b;c:d'] },
      end: 18,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle multiple quoted values', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(
      parseParameters('x;TYPE="a b c","d e f":x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { TYPE: ['a b c', 'd e f'] },
      end: 22,
    });
    expect(nags).toStrictEqual([]);
  });
  it('should handle mixed values', () => {
    let nags: Nag<VCardNagAttributes>[] = [];
    expect(
      parseParameters('x;TYPE="a b c",d e f,"g h i":x', 1, nags, 'X'),
    ).toStrictEqual({
      parameters: { TYPE: ['a b c', 'd e f', 'g h i'] },
      end: 28,
    });
    expect(nags).toStrictEqual([]);
  });
});

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
    });
  });

  it('should nag about underspecified cards', () => {
    expect(parseVCards('END:VCARD', true)).toStrictEqual({
      vCards: [
        {
          BEGIN: { value: 'VCARD' },
          END: { value: 'VCARD' },
          FN: [{ value: '*** Missing Full Name ***' }],
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
    });
  });

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
    });
  });

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
    });
  });

  // it('should work with an exotic vCard', () => {
  //   expect(parseVCards('BEGIN:VCARD\n', true)).toStrictEqual({
  //     vCards: [],
  //   });
  //  });
});
