import { ArrowDown, MousePointer2, Volume2, Waves } from 'lucide-react';
import { DemoWebsite } from './components/DemoWebsite.js';
import { ReaderControls } from './components/ReaderControls.js';
import { usePreviewReader } from './hooks/usePreviewReader.js';

export function App() {
  const reader = usePreviewReader();
  return (
    <>
      <a className="skip-link" href="#demo-title">
        Skip to the sample website
      </a>
      <header className="site-header" data-pagevoice-ignore>
        <a className="wordmark" href="#top">
          <span className="brand-icon">
            <Waves size={23} aria-hidden="true" />
          </span>
          pagevoice<span className="brand-dot">.</span>
        </a>
        <span className="header-note">A little voice. A more accessible web.</span>
        <a className="quiet-link" href="#install">
          Install the extension <ArrowDown size={14} aria-hidden="true" />
        </a>
      </header>
      <main id="top">
        <section className="intro" data-pagevoice-ignore>
          <p className="eyebrow">
            <span className="small-dot" /> CHROME EXTENSION · HOVER TO HEAR
          </p>
          <h1>
            Point. Listen.
            <br />
            <span>Understand.</span>
          </h1>
          <p className="intro-copy">
            Move your mouse over words, links or buttons.
            <br />
            PageVoice reads them aloud. It’s that simple.
          </p>
        </section>
        <div className="workspace">
          <DemoWebsite />
          <aside className="preview-sidebar" aria-label="Reading controls">
            <ReaderControls
              enabled={reader.enabled}
              settings={reader.settings}
              error={reader.error}
              onToggle={reader.toggle}
              onSettings={reader.setSettings}
              onStop={reader.stop}
              onRepeat={reader.repeat}
            />
            <div className="last-read" data-pagevoice-ignore>
              <p className="eyebrow">
                <Volume2 size={14} aria-hidden="true" /> LAST READING
              </p>
              <p>{reader.lastRead}</p>
            </div>
            <p className="preview-note" data-pagevoice-ignore>
              This page is a browser preview. Install the Chrome extension to use hover reading on
              other websites.
            </p>
          </aside>
        </div>
        <section className="instructions" id="install" data-pagevoice-ignore>
          <div>
            <p className="eyebrow">READY FOR THE REST OF THE WEB</p>
            <h2>Take PageVoice with you.</h2>
            <p>
              Enable it on the page you want to hear. PageVoice starts off on each new page and
              never clicks or submits anything.
            </p>
          </div>
          <ol>
            <li>
              <span>01</span>
              <div>
                <h3>Load the extension</h3>
                <p>
                  Build the project, open Chrome’s Extensions page, enable Developer mode, and
                  choose Load unpacked. Select the <code>dist-extension</code> folder. Full steps
                  are in the README.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Turn on reading</h3>
                <p>
                  Open a website, select the PageVoice toolbar icon, then choose Turn on reading.
                  Close the popup and move over the page.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Make it yours</h3>
                <p>
                  Choose sentences or individual words, adjust the speed, or use Tab to hear
                  controls. Press Escape to stop speech.
                </p>
              </div>
            </li>
          </ol>
        </section>
      </main>
      <footer className="site-footer" data-pagevoice-ignore>
        <span>
          pagevoice. <span className="footer-divider">/</span> Accessibility prototype
        </span>
        <span>
          <MousePointer2 size={13} aria-hidden="true" /> Made for a web you can hear
        </span>
      </footer>
    </>
  );
}
