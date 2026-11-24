import { useEffect } from 'react';
import { t } from '../i18n';
import { rich } from '../i18n/rich';

/** Open-source projects the game runs on (web/, server/) or is made with (tests, trailer). Names stay untranslated. */
const CREDITS: { name: string; href: string; packages?: string[] }[] = [
  { name: 'React', href: 'https://react.dev/' },
  { name: 'Vite', href: 'https://vite.dev/' },
  { name: 'TypeScript', href: 'https://www.typescriptlang.org/' },
  { name: 'Node.js', href: 'https://nodejs.org/' },
  { name: 'AI SDK', href: 'https://ai-sdk.dev/', packages: ['ai', '@ai-sdk/anthropic', '@ai-sdk/openai', '@ai-sdk/deepseek', '@ai-sdk/google'] },
  { name: 'OpenRouter AI SDK Provider', href: 'https://github.com/OpenRouterTeam/ai-sdk-provider', packages: ['@openrouter/ai-sdk-provider'] },
  { name: 'Fontsource', href: 'https://fontsource.org/' },
  { name: 'Archivo', href: 'https://fontsource.org/fonts/archivo' },
  { name: 'JetBrains Mono', href: 'https://fontsource.org/fonts/jetbrains-mono' },
  { name: 'Playwright', href: 'https://playwright.dev/' },
  { name: 'FFmpeg', href: 'https://ffmpeg.org/' },
];

/** /about: what the game is, in the game's own deadpan. */
export function About() {
  // The page is drawn after the browser looked for the #anchor, so /about#credits scrolls here.
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, []);

  return (
    <main className="about">
      <article className="about-sheet">
        <a className="about-back" href="/">
          {t('about.back')}
        </a>
        <h1>{t('about.title')}</h1>

        <h2>{t('about.job')}</h2>
        <p>{rich('about.job.1')}</p>
        <p>{rich('about.job.2')}</p>
        <p>{rich('about.job.3')}</p>
        <p>{rich('about.job.4')}</p>
        <p>{rich('about.job.5')}</p>

        <h2>{t('about.workplaces')}</h2>
        <ul>
          <li>{rich('about.workplaces.fresh')}</li>
          <li>{rich('about.workplaces.legacy')}</li>
        </ul>
        <p>{rich('about.workplaces.tasks')}</p>
        <p>{rich('about.workplaces.simulated')}</p>

        <h2>{t('about.name')}</h2>
        <p>{rich('about.name.1')}</p>

        <h2>{t('about.keys')}</h2>
        <p>{rich('about.keys.1')}</p>
        <p>{rich('about.keys.2')}</p>

        <h2 id="credits">{t('about.credits')}</h2>
        <p>{rich('about.credits.intro')}</p>
        <p>{rich('about.credits.avatar')}</p>
        <ul className="credits">
          {CREDITS.map((c) => (
            <li key={c.name}>
              <a href={c.href} target="_blank" rel="noreferrer">
                {c.name}
              </a>
              {c.packages && <span className="credits-packages">{c.packages.join(' · ')}</span>}
            </li>
          ))}
        </ul>

        <p className="about-cta">
          <a className="btn btn-ink btn-big" href="/">
            {t('start.clockIn')}
          </a>
          <a className="about-faq" href="/faq">
            {t('links.faq')}
          </a>
        </p>
      </article>
    </main>
  );
}
