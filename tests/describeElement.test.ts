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
  it.each(['submit', 'button', 'reset'])('reads a native %s input button caption', (type) => {
    const button = element(`<input type="${type}" value="Find events">`, 'input');
    expect(describeControl(button)).toBe('Find events. Button.');
  });
  it('prefers an explicit accessible label to an input button caption', () => {
    const button = element(
      '<input type="submit" value="Go" aria-label="Find events" disabled>',
      'input',
    );
    expect(describeControl(button)).toBe('Find events. Button. Disabled.');
  });
  it('does not use an entered field value as a missing-label fallback', () => {
    const field = element('<input type="text" value="Private entered value">', 'input');
    expect(describeControl(field)).toBe('Unlabelled. Text field.');
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
  it('does not read a paragraph when word mode cannot locate a word', () => {
    const paragraph = element('<p>Hello there. A second sentence.</p>', 'p');
    expect(describeAtPoint(paragraph, 0, 0, 'word')).toBe('');
    expect(describeAtPoint(paragraph, 0, 0, 'sentence')).toBe('Hello there. A second sentence.');
  });
});
