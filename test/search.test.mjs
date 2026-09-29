import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { searchItems, tokenize } from '../dist/core/search.js';

/** Search only ever reads these fields, so fixtures can stay small. */
const item = (id, title, summary, extra = {}) => ({ id, title, summary, ...extra });

const ids = scored => scored.map(entry => entry.item.id);

const languages = [
    item('c-lang', 'C programming basics', 'Pointers, structs and the preprocessor.', {
        category: 'guides',
        tags: ['c'],
        content: 'C is a small language.'
    }),
    item('code-style', 'Code style guide', 'How we format and review code.', {
        category: 'guides',
        tags: ['style'],
        content: 'Write code others can read.'
    })
];

const energy = [
    item('solar-basics', 'Solar power basics', 'Panels, inverters and arrays.', {
        category: 'energy',
        tags: ['solar'],
        content: 'Solar arrays scale well.'
    }),
    item('wind-basics', 'Wind turbine basics', 'Blades and gearboxes.', {
        category: 'energy',
        tags: ['wind'],
        content: 'A turbine needs wind.'
    }),
    item('hydro-dams', 'Hydro dams', 'Water storage and head height.', {
        category: 'energy',
        tags: ['hydro'],
        content: 'A dam stores water.'
    })
];

describe('tokenize', () => {
    it('keeps a one-character token when the query has longer tokens too', () => {
        // Regression: "c" was discarded purely because "code" was longer, so
        // "C code" silently became a search for "code".
        assert.deepEqual(tokenize('C code'), ['c', 'code']);
        assert.deepEqual(tokenize('R packages'), ['r', 'packages']);
        assert.deepEqual(tokenize('learn C'), ['learn', 'c']);
    });

    it('drops a single-letter stop word when the query has more to go on', () => {
        assert.deepEqual(tokenize('solar a'), ['solar']);
        assert.deepEqual(tokenize('a solar panel'), ['solar', 'panel']);
    });

    it('keeps a query made of nothing but one character', () => {
        assert.deepEqual(tokenize('R'), ['r']);
        assert.deepEqual(tokenize('C'), ['c']);
        // Even a stop word: a bare "a" is a deliberate search, and returning no
        // tokens here would read to the caller as "your query was punctuation".
        assert.deepEqual(tokenize('a'), ['a']);
        assert.deepEqual(tokenize('  A!  '), ['a']);
    });

    it('keeps +, # and . inside tokens', () => {
        assert.deepEqual(tokenize('c++'), ['c++']);
        assert.deepEqual(tokenize('C# and node.js'), ['c#', 'and', 'node.js']);
    });

    it('discards punctuation and casing noise', () => {
        assert.deepEqual(tokenize('  Stdout,   LOGGING!  '), ['stdout', 'logging']);
        assert.deepEqual(tokenize('!!! ??? ---'), []);
        assert.deepEqual(tokenize(''), []);
    });
});

describe('searchItems with a one-character term', () => {
    it('finds the C entry for "C code"', () => {
        // Before the fix this returned code-style alone: the C entry was
        // unreachable by the query that describes it best.
        assert.ok(ids(searchItems(languages, 'C code')).includes('c-lang'));
    });

    it('does not collapse "C code" into "code"', () => {
        assert.notDeepEqual(ids(searchItems(languages, 'C code')), ids(searchItems(languages, 'code')));
    });

    it('still answers a lone one-character query', () => {
        assert.deepEqual(ids(searchItems(languages, 'C')), ['c-lang', 'code-style']);
    });
});

describe('searchItems with a single-letter stop word', () => {
    it('ranks "solar a" exactly like "solar"', () => {
        assert.deepEqual(searchItems(energy, 'solar a'), searchItems(energy, 'solar'));
    });

    it('does not let a stray "a" match every entry', () => {
        // "a" is a substring of most words, so scoring it would surface the
        // whole catalog and dilute the coverage bonus.
        assert.deepEqual(ids(searchItems(energy, 'solar a')), ['solar-basics']);
    });
});

describe('searchItems query handling', () => {
    it('browses alphabetically when the query is blank', () => {
        assert.deepEqual(ids(searchItems(energy, '   ')), ['hydro-dams', 'solar-basics', 'wind-basics']);
    });

    it('returns nothing when the query is all punctuation', () => {
        assert.deepEqual(searchItems(energy, '!!!'), []);
    });

    it('applies filters alongside tokens', () => {
        assert.deepEqual(ids(searchItems(energy, 'basics', { tags: ['solar'] })), ['solar-basics']);
        assert.deepEqual(searchItems(energy, 'basics', { category: 'guides' }), []);
    });
});
