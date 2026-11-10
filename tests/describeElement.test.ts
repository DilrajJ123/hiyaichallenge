// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  describeAtPoint,
  describeControl,
  safeText,
  textSegment,
} from '../src/lib/describeElement.js';

afterEach(() => {
  document.body.innerHTML = '';
});
const element = (html: string, selector: string) => {
  document.body.innerHTML = html;
  return document.querySelector(selector)!;
};

describe('hover descriptions', () => {
  it('reads the parent button when hovering its inner icon', () => {
    expect(
      describeControl(element('<button aria-label="Search"><svg><path /></svg></button>', 'path')),
    ).toBe('Search. Button.');
  });
  it('resolves aria-labelledby and explains disabled controls', () => {
    expect(
      describeControl(
        element(
          '<span id="name">Save document</span><button aria-labelledby="name" disabled></button>',
          'button',
        ),
      ),
    ).toBe('Save document. Button. Disabled.');
  });
  it('describes a link without reading its URL or query parameters', () => {
    expect(
      describeControl(element('<a href="https://example.com/?token=private">About us</a>', 'a')),
    ).toBe('About us. Link.');
  });
  it('reads a field label without its entered value', () => {
    const field = element(
      '<label for="name">Your name</label><input id="name" value="Private Person" required>',
      'input',
    );
    expect(describeControl(field)).toBe('Your name. Text field. Required.');
  });
  it('never reads password contents', () => {
    const field = element(
      '<label for="password">Password</label><input id="password" type="password" value="private123">',
      'input',
    );
    expect(describeControl(field)).toBe('Password. Password field. Contents are not read.');
  });
  it('excludes hidden and editable descendants from paragraph text', () => {
    const paragraph = element(
      '<p>Hello <span hidden>private</span><span contenteditable>secret draft</span><textarea>another secret</textarea> world.</p>',
      'p',
    );
    expect(safeText(paragraph)).toBe('Hello world.');
  });
  it('ignores controls hidden by an ancestor', () => {
    const button = element('<div style="display:none"><button>Hidden</button></div>', 'button');
    expect(describeAtPoint(button, 0, 0, 'sentence')).toBe('');
  });
  it('describes checked state', () => {
    expect(
      describeControl(
        element('<label><input type="checkbox" checked> Email updates</label>', 'input'),
      ),
    ).toBe('Email updates. Checkbox. Checked.');
  });
  it('announces an unlabelled button without inventing its purpose', () => {
    expect(describeControl(element('<button><svg /></button>', 'button'))).toBe(
      'Unlabelled. Button.',
    );
  });
  it('selects the word or sentence under the pointer offset', () => {
    expect(textSegment('Hello there. A second sentence.', 16, 'word')).toBe('second');
    expect(textSegment('Hello there. A second sentence.', 16, 'sentence')).toBe(
      'A second sentence.',
    );
  });
});
