import { useState } from 'react';
import { ArrowUpRight, Bookmark, Search } from 'lucide-react';

export function DemoWebsite() {
  const [message, setMessage] = useState(
    'These are sample controls. Nothing is submitted or saved.',
  );
  return (
    <section className="demo-website" aria-labelledby="demo-title">
      <div className="demo-browser-bar" data-pagevoice-ignore>
        <span className="browser-dots">
          <i />
          <i />
          <i />
        </span>
        <span>A sample website to explore</span>
        <span className="sample-pill">Demo</span>
      </div>
      <div className="demo-content">
        <div className="demo-brand">
          northbank<span>COMMUNITY & CULTURE</span>
        </div>
        <nav className="demo-nav" aria-label="Sample website navigation">
          <a href="#demo-events">What’s on</a>
          <a href="#demo-about">About us</a>
          <a href="#demo-form">Stay in touch</a>
        </nav>
        <p className="eyebrow">SOMETHING FOR EVERYONE</p>
        <h2 id="demo-title">
          Make room for
          <br />
          something new.
        </h2>
        <p className="demo-description" id="demo-about">
          A small place for big ideas. Discover workshops, meet your neighbours, and find something
          you love.
        </p>
        <div className="demo-actions" id="demo-events">
          <button
            type="button"
            className="demo-primary"
            onClick={() => setMessage('Demo: this button would open the events listing.')}
          >
            <Search size={17} aria-hidden="true" />
            Find events
            <ArrowUpRight size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="demo-secondary"
            onClick={() => setMessage('Demo: nothing was saved.')}
          >
            <Bookmark size={17} aria-hidden="true" />
            Save this page
          </button>
        </div>
        <div className="demo-quote">
          <span aria-hidden="true">“</span>
          <p>
            You don’t need to be an expert.
            <br />
            Just bring your curiosity.
          </p>
        </div>
        <div className="demo-form" id="demo-form">
          <h3>A place to begin</h3>
          <p>
            Try hovering the field below. PageVoice reads its label, not anything entered into it.
          </p>
          <label htmlFor="demo-name">Your name</label>
          <input id="demo-name" placeholder="A sample field" autoComplete="off" />
          <label className="demo-checkbox">
            <input type="checkbox" />
            I’d like to hear about upcoming events
          </label>
        </div>
        <p className="demo-feedback" role="status">
          {message}
        </p>
      </div>
    </section>
  );
}
