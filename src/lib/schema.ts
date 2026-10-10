// Structured data (schema.org JSON-LD) for search engines and AI search. Every page carries the business node;
// product pages add their service, the home page the website. Same facts as on the pages (FAQ: travel ~1 h around Amsterdam).
import { CONTACT, floorPath, localize, type Floor, type Lang } from '../content/floors.ts';

const SITE = 'https://eppingmusic.com';
const BIZ = `${SITE}/#business`;
const AREA = ['Amsterdam', 'Haarlem', 'Amstelveen', 'Utrecht', 'Rotterdam'].map((name) => ({ '@type': 'City', name }));
const SERVICE_TYPE: Record<Floor['slug'], string> = { 'rave-wedding': 'Wedding DJ', 'private-events': 'Party DJ', presents: 'Pop-up parties' };

export const business = (description?: string) => ({
  '@type': 'EntertainmentBusiness', '@id': BIZ, name: 'EPPING', legalName: 'Epping Music', url: `${SITE}/`,
  logo: `${SITE}/brand/epping-logo.png`, image: `${SITE}/og.jpg`, ...(description && { description }),
  email: CONTACT.email, telephone: '+31640187865', priceRange: 'On request',
  areaServed: AREA, knowsLanguage: ['en', 'nl'], sameAs: [CONTACT.instagram, CONTACT.soundcloud],
});

export const graph = (...nodes: object[]) => JSON.stringify({ '@context': 'https://schema.org', '@graph': nodes });

export const website = () => ({ '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: 'EPPING', publisher: { '@id': BIZ } });

export const service = (f: Floor, lang: Lang) => {
  const l = localize(f, lang);
  return { '@type': 'Service', '@id': `${SITE}${floorPath(f, lang)}#service`, name: f.name, serviceType: SERVICE_TYPE[f.slug],
    description: l.description, url: `${SITE}${floorPath(f, lang)}`, inLanguage: lang, provider: { '@id': BIZ }, areaServed: AREA };
};
