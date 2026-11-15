import assert from 'node:assert/strict';
import test from 'node:test';
import { searchItems, tokenize } from '../dist/core/search.js';

test('keeps meaningful single-character terms beside longer terms', () => {
    assert.deepEqual(tokenize('C code'), ['c', 'code']);
});

test('drops English filler letters when longer terms are present', () => {
    assert.deepEqual(tokenize('solar a'), ['solar']);
    assert.deepEqual(tokenize('type i script'), ['type', 'script']);
});

test('keeps a single-character-only query searchable', () => {
    assert.deepEqual(tokenize('R'), ['r']);
    assert.deepEqual(tokenize('a'), ['a']);
});

test('finds an item that matches only the meaningful single-character term', () => {
    const items = [
        {
            id: 'c-language',
            title: 'C language',
            summary: 'A guide to the language.',
            category: 'Languages',
            tags: ['language'],
            content: '',
        },
    ];

    assert.deepEqual(
        searchItems(items, 'C code').map(result => result.item.id),
        ['c-language']
    );
});
