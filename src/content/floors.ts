// Floor pages: copy and links. Edit freely; the same content feeds the overlay on / and the /<slug>/ routes.
export type Slug = 'rave-wedding' | 'private-events' | 'presents';
/** video: poster is the thumbnail; photo: src is used for both. caption: alt text only, never shown */
export interface GalleryItem { kind: 'video' | 'photo'; src: string; poster?: string; caption: string; length?: string }
export interface Floor {
  slug: Slug; n: string; name: string;
  /** search: <title> and meta description (~60 / ~155 chars) */
  title: string; description: string;
  tagline: string; intro: string; body: string[]; includes: string[];
  event?: { date: string; place: string; note: string };
  /** photos and clips under the mix, opened in a lightbox; paths relative to the site root, files in public/media/floors/ */
  gallery?: { title: string; items: GalleryItem[] };
  /** url: public SoundCloud page; embed: optional player URL (SoundCloud's own api URL works best for sets) */
  mix: { title: string; length: string; url: string; embed?: string };
  /** questions at the bottom of the page, also sent to search engines as FAQ data (FloorRoute.astro) */
  faq?: { q: string; a: string }[];
  cta: string;
  /** booking pages: prefilled WhatsApp + email; follow: one Instagram button instead (no list to sign up for) */
  mail?: { subject: string; body: string }; whatsapp?: string; follow?: boolean;
}

export const CONTACT = {
  email: 'bookings@eppingmusic.com', whatsapp: '31640187865', whatsappLabel: '+31 6 4018 7865',
  instagram: 'https://www.instagram.com/epping.music/', instagramLabel: '@epping.music',
  /** footer line on product pages and About (KvK number on the website) */
  legal: 'Epping Music · KvK 98899759', soundcloud: 'https://soundcloud.com/arno-epping',
};

export const FLOORS: Floor[] = [
  {
    slug: 'rave-wedding', n: '01', name: 'Rave Wedding',
    title: 'Rave wedding DJ in Amsterdam | EPPING',
    description: 'House, techno and trance wedding DJ. I start where everyone dances and build to your favourite club night. Club sound and lights included.',
    tagline: 'From grandma’s favourite to your favourite club',
    intro: 'They say it’s the most important day of your life, so the party should be the best one too. I start where everyone can dance, grandma included, and slowly build towards the club and festival nights you love.',
    body: [
      'Before the wedding, we go through the music you love together, so the second half of the night sounds like your favourite night out. Whether it’s house, techno, trance or something in between.',
      'Club sound and light come with it, so for a few hours your venue feels like the place you’d normally go out to.',
    ],
    includes: ['Planning call and a shared playlist', 'One set, from first dance to final track', 'Club sound and lights, smoke on request'],
    gallery: {
      title: 'Footage from the dancefloor',
      items: [
        { kind: 'photo', src: 'media/floors/rave-wedding/wa-1.jpg', caption: 'Behind the decks' },
        { kind: 'photo', src: 'media/floors/rave-wedding/wa-2.jpg', caption: 'First dance' },
        { kind: 'photo', src: 'media/floors/rave-wedding/wa-3.jpg', caption: 'First dance, close up' },
        { kind: 'photo', src: 'media/floors/rave-wedding/wa-4.jpg', caption: 'The lift' },
        { kind: 'video', src: 'media/floors/rave-wedding/clip-4096.mp4', poster: 'media/floors/rave-wedding/clip-4096.jpg', caption: 'Glow sticks out', length: '0:21' },
        { kind: 'video', src: 'media/floors/rave-wedding/clip-4097.mp4', poster: 'media/floors/rave-wedding/clip-4097.jpg', caption: 'The bride on the floor', length: '0:30' },
      ],
    },
    // for now the ADE House Mix everywhere; the wedding set (sets/marta-donalds-wedding, embed api.soundcloud.com/playlists/2277399272) has no public tracks yet
    mix: { title: 'ADE House Mix', length: 'Mix', url: 'https://soundcloud.com/arno-epping/ade-house-mix' },
    faq: [
      { q: 'What is a rave wedding?', a: 'A wedding party that slowly turns into a club night. I start with music everyone dances to, grandma included, and build towards the house, techno or trance you love. Club sound and lights come with it.' },
      { q: 'Can you do a techno, house or trance wedding?', a: 'Yes. Techno, house, trance, UK garage or a mix of everything. Together we decide how far the night goes.' },
      { q: 'What does it cost?', a: 'Every wedding gets its own quote. The price depends on the hours, the gear you want and the travel time. Send me your date and I’ll get back to you with a price.' },
      { q: 'Do you also play outside Amsterdam?', a: 'Yes. I play in Amsterdam and up to about an hour around it, for example in Haarlem, Amstelveen, Utrecht or Rotterdam. The travel time is part of the quote.' },
      { q: 'How long do you play?', a: 'Up to 5 or 6 hours, longer if you like, with a short break somewhere in the night.' },
      { q: 'Do you also do the ceremony or dinner?', a: 'No. I focus on the party, from the first dance to the final track.' },
      { q: 'Can guests make requests?', a: 'They can ask, and I play it if it fits the moment. Before the wedding we make a must-play list and a do-not-play list. You’re in charge, always.' },
      { q: 'What do you bring, and what does the venue need?', a: 'Speakers, lights, smoke and microphones, matched to your guest count and venue. The venue only needs enough power outlets. Let me know its sound limit and end time, if it has one.' },
      { q: 'How far ahead should we book?', a: 'Ideally six months ahead. A 50% deposit secures your date.' },
      { q: 'What happens in the planning call?', a: 'We get to know each other, in person or online. I explain how I work and we go through your ideas, the vibe and the music you want to hear. That becomes a shared playlist with your must-plays. If you like, we visit the venue together.' },
      { q: 'Can you do announcements, like the first dance or the cake?', a: 'Yes, in Dutch or English.' },
      { q: 'Can we talk to couples you’ve played for?', a: 'Yes, references are available on request.' },
      { q: 'Are you an English-speaking wedding DJ?', a: 'Yes. I speak English and Dutch.' },
    ],
    cta: 'Check your date',
    mail: { subject: 'Rave Wedding booking', body: 'Hi EPPING,\n\nWe are getting married on [date] and are interested in booking you as our DJ!\n\n' },
    whatsapp: 'Hi EPPING, we are getting married on [date] and are interested in booking you as our DJ!',
  },
  {
    slug: 'private-events', n: '02', name: 'Private Events',
    title: 'Party DJ for private events in Amsterdam | EPPING',
    description: 'DJ for birthdays, house parties and company events. Good sound, good lights and music that keeps the dancefloor moving.',
    tagline: 'Club energy at any venue',
    intro: 'Birthdays, house parties, company events. Club sound and club lights, at any venue. You bring the people, I bring the peak.',
    body: [
      'Want to level up your party? It comes down to three things: good sound, good lights and music that keeps the dancefloor moving. I take care of all three.',
      'Before the party we go through the music you love and the vibe you want, so the speakers, the lights and the set all match your night.',
    ],
    includes: ['Planning call and a shared playlist', 'One set, from first guest to final track', 'Sound and lights matched to your venue'],
    gallery: {
      title: 'Footage from the dancefloor',
      items: [
        { kind: 'video', src: 'media/floors/private-events/clip-3672.mp4', poster: 'media/floors/private-events/clip-3672.jpg', caption: 'Hoofddorpplein Festival, the crowd', length: '0:22' },
        { kind: 'video', src: 'media/floors/private-events/clip-3669.mp4', poster: 'media/floors/private-events/clip-3669.jpg', caption: 'Hoofddorpplein Festival, behind the decks', length: '0:28' },
        { kind: 'photo', src: 'media/floors/private-events/photo-1.jpg', caption: 'Young fans at the decks' },
      ],
    },
    mix: { title: 'ADE House Mix', length: 'Mix', url: 'https://soundcloud.com/arno-epping/ade-house-mix' },
    faq: [
      { q: 'Which parties do you play?', a: 'Birthdays, house parties, company events and festivals. Any reason to party, really.' },
      { q: 'What does it cost?', a: 'Every party gets its own quote, based on the hours, the gear and the travel time. Send me the date and the kind of party, and I’ll get back to you with a price.' },
      { q: 'How big or small can the party be?', a: 'From a living room to a festival field. The sound and lights are matched to the size of your party.' },
      { q: 'What about the neighbours?', a: 'We agree on the volume and the end time in the planning call, and I match the setup to the space.' },
      { q: 'Can you play outdoors?', a: 'Yes: rooftops, squares, parks and festivals. All I need is power, and cover for the gear if it might rain.' },
      { q: 'Can you send an invoice for a company event?', a: 'Yes, you’ll get an invoice from Epping Music.' },
      { q: 'Do you also play outside Amsterdam?', a: 'Yes. I play in Amsterdam and up to about an hour around it, for example in Haarlem, Amstelveen, Utrecht or Rotterdam. The travel time is part of the quote.' },
      { q: 'Which music do you play?', a: 'House, techno, trance, UK garage, or a mix that matches your crowd. We work that out together in the planning call.' },
      { q: 'How far ahead should I book?', a: 'As early as you can. A few months ahead is ideal, last minute is sometimes possible.' },
    ],
    cta: 'Plan your party',
    mail: { subject: 'Private event booking', body: 'Hi EPPING,\n\nI’m planning a [type of party] on [date] and am interested in booking you as my DJ!\n\n' },
    whatsapp: 'Hi EPPING, I’m planning a [type of party] on [date] and am interested in booking you as my DJ!',
  },
  {
    slug: 'presents', n: '03', name: 'EPPING Presents',
    title: 'EPPING Presents | Pop-up parties in Amsterdam',
    description: 'Our own parties, open to everyone: rooftops, parks and squares around Amsterdam. Follow @epping.music for the next one.',
    tagline: 'Anywhere we can plug in',
    intro: 'Our own parties, open to everyone. The music we love, played loud, wherever we can get away with it.',
    body: ['A few times a year we take over a rooftop, a park or a square for a day or a night. Follow along so you don’t hear about it the day after.'],
    event: { date: 'Thu 22 October 2026', place: 'Hoofddorpplein, Amsterdam', note: 'Silent disco during ADE · 19:00 – 22:00' }, // remove after the night to hide the block
    includes: [], // no list on this page
    gallery: {
      title: 'Footage from the dancefloor',
      items: [
        { kind: 'video', src: 'media/floors/presents/street.mp4', poster: 'media/floors/presents/street.jpg', caption: 'From the street', length: '0:10' },
        { kind: 'video', src: 'media/floors/presents/clip-6824.mp4', poster: 'media/floors/presents/clip-6824.jpg', caption: 'Dusk set', length: '0:25' },
        { kind: 'video', src: 'media/floors/presents/clip-6827.mp4', poster: 'media/floors/presents/clip-6827.jpg', caption: 'One more', length: '0:17' },
        { kind: 'video', src: 'media/floors/presents/clip-6830.mp4', poster: 'media/floors/presents/clip-6830.jpg', caption: 'Hands up', length: '0:19' },
        { kind: 'video', src: 'media/floors/presents/clip-6821.mp4', poster: 'media/floors/presents/clip-6821.jpg', caption: 'Lights on', length: '0:33' },
        { kind: 'video', src: 'media/floors/presents/booth.mp4', poster: 'media/floors/presents/booth.jpg', caption: 'Getting ready', length: '0:09' },
        { kind: 'photo', src: 'media/floors/presents/photo-1.jpg', caption: 'Soundcheck' },
        { kind: 'photo', src: 'media/floors/presents/photo-2.jpg', caption: 'First track' },
        { kind: 'photo', src: 'media/floors/presents/photo-3.jpg', caption: 'Roof with a view' },
        { kind: 'photo', src: 'media/floors/presents/photo-4.jpg', caption: 'Hello' },
        { kind: 'photo', src: 'media/floors/presents/photo-5.jpg', caption: 'In the mix' },
      ],
    },
    mix: { title: 'ADE House Mix', length: 'Mix', url: 'https://soundcloud.com/arno-epping/ade-house-mix' },
    cta: 'Follow for the next one',
    follow: true,
  },
];

export const SLUGS: Slug[] = FLOORS.map((f) => f.slug);
export const floorBySlug = (s: string): Floor | undefined => FLOORS.find((f) => f.slug === s);

// ---------- Dutch (product pages only; the entrance stays English). Copy from the doc "EPPING Dutch product pages". ----------
export type Lang = 'en' | 'nl';
type NlFloor = Pick<Floor, 'title' | 'description' | 'tagline' | 'intro' | 'body' | 'includes' | 'cta'> &
  Partial<Pick<Floor, 'mail' | 'whatsapp' | 'event' | 'faq'>> & { path: string; captions?: string[] };

const NL: Record<Slug, NlFloor> = {
  'rave-wedding': {
    path: 'rave-bruiloft',
    title: 'Rave bruiloft DJ in Amsterdam | EPPING',
    description: 'House-, techno- en trance-DJ voor jullie bruiloft. Ik begin waar iedereen danst en bouw op naar jullie favoriete clubavond. Clubgeluid en -licht inbegrepen.',
    tagline: 'Van ABBA met oma tot beuken met vrienden',
    intro: 'Ze zeggen dat het de belangrijkste dag van jullie leven is, dus dan moet het feest ook het beste feest ooit worden. Ik begin met nummers voor iedereen, inclusief oma, en bouw langzaam op naar de club- en festivalnachten waar jullie van houden.',
    body: [
      'Voor de bruiloft gaan we samen door de muziek waar jullie van houden, zodat de tweede helft van de avond klinkt als jullie favoriete avond uit. Of het nu house, techno, trance of iets daartussenin is.',
      'Clubgeluid en -licht komen mee, zodat jullie locatie een paar uur voelt als de plek waar jullie normaal uitgaan.',
    ],
    includes: ['Kennismakingsgesprek en een gedeelde playlist', 'Eén set, van openingsdans tot laatste plaat', 'Clubgeluid en -licht, rook op aanvraag'],
    faq: [
      { q: 'Wat is een rave bruiloft?', a: 'Een bruiloftsfeest dat langzaam een clubavond wordt. Ik begin met muziek waar iedereen op danst, inclusief oma, en bouw op naar de house, techno of trance waar jullie van houden. Clubgeluid en -licht komen mee.' },
      { q: 'Kun je ook een techno-, house- of trancebruiloft draaien?', a: 'Ja. Techno, house, trance, UK garage of een mix van alles. Samen bepalen we hoe ver de avond gaat.' },
      { q: 'Wat kost het?', a: 'Elke bruiloft krijgt een eigen offerte. De prijs hangt af van het aantal uren, de apparatuur die jullie willen en de reistijd. Stuur me jullie datum, dan krijgen jullie een prijs.' },
      { q: 'Draai je ook buiten Amsterdam?', a: 'Ja. Ik draai in Amsterdam en tot ongeveer een uur daaromheen, bijvoorbeeld in Haarlem, Amstelveen, Utrecht of Rotterdam. De reistijd zit in de offerte.' },
      { q: 'Hoe lang draai je?', a: 'Tot 5 of 6 uur, langer mag ook, met ergens in de avond een korte pauze.' },
      { q: 'Doe je ook de ceremonie of het diner?', a: 'Nee. Ik focus op het feest, van de openingsdans tot de laatste plaat.' },
      { q: 'Kunnen gasten verzoekjes doen?', a: 'Ze mogen het vragen, en ik draai het als het past op dat moment. Voor de bruiloft maken we een must-play- en een do-not-play-lijst. Jullie hebben altijd de leiding.' },
      { q: 'Wat neem je mee, en wat heeft de locatie nodig?', a: 'Speakers, licht, rook en microfoons, afgestemd op het aantal gasten en de locatie. De locatie heeft alleen genoeg stopcontacten nodig. Laat me de geluidslimiet en eindtijd weten, als die er zijn.' },
      { q: 'Hoe ver van tevoren moeten we boeken?', a: 'Het liefst zes maanden van tevoren. Met een aanbetaling van 50% staat jullie datum vast.' },
      { q: 'Wat gebeurt er in het kennismakingsgesprek?', a: 'We leren elkaar kennen, live of online. Ik vertel hoe ik werk en we gaan door jullie ideeën, de vibe en de muziek die jullie willen horen. Dat wordt een gedeelde playlist met jullie must-plays. Als jullie willen, bekijken we samen de locatie.' },
      { q: 'Kun je ook dingen aankondigen, zoals de openingsdans of de taart?', a: 'Ja, in het Nederlands of Engels.' },
      { q: 'Kunnen we stellen spreken bij wie je hebt gedraaid?', a: 'Ja, referenties zijn op aanvraag beschikbaar.' },
      { q: 'Spreek je ook Engels?', a: 'Ja. Ik spreek Engels en Nederlands.' },
    ],
    cta: 'Is jullie datum nog vrij?',
    mail: { subject: 'Aanvraag voor onze bruiloft', body: 'Hoi EPPING,\n\nWij gaan trouwen op [datum] en willen je graag boeken als onze DJ!\n\n' },
    whatsapp: 'Hoi EPPING, wij gaan trouwen op [datum] en willen je graag boeken als onze DJ!',
    captions: ['Achter de draaitafels', 'Openingsdans', 'Openingsdans, dichtbij', 'De lift', 'Glowsticks in de lucht', 'De bruid op de dansvloer'],
  },
  'private-events': {
    path: 'feest-dj',
    title: 'Feest DJ in Amsterdam voor privéfeesten | EPPING',
    description: 'DJ voor verjaardagen, huisfeesten en bedrijfsfeesten. Geluid en licht op clubniveau, en muziek die de dansvloer vol houdt.',
    tagline: 'De club komt naar jou',
    intro: 'Verjaardagen, huisfeesten, bedrijfsfeesten. Clubgeluid en clublicht, op elke locatie. Jij zorgt voor het publiek, ik regel de energie.',
    body: [
      'Wil jij je feest naar een hoger niveau tillen? Het draait om drie dingen: goed geluid, goed licht en muziek die de dansvloer vult. Ik zorg voor alle drie.',
      'Voor het feest begint bespreken we de muziek waar je van houdt en de vibe die je zoekt, zodat de speakers, het licht en de set precies bij jouw feest passen.',
    ],
    includes: ['Kennismakingsgesprek en een gedeelde playlist', 'Eén set, van eerste gast tot laatste plaat', 'Geluid en licht afgestemd op je locatie'],
    faq: [
      { q: 'Op welke feesten draai je?', a: 'Verjaardagen, huisfeesten, bedrijfsfeesten en festivals. Eigenlijk elke reden voor een feest.' },
      { q: 'Wat kost het?', a: 'Elk feest krijgt een eigen offerte, op basis van het aantal uren, de apparatuur en de reistijd. Stuur me de datum en wat voor feest het is, dan krijg je een prijs.' },
      { q: 'Hoe groot of klein mag het feest zijn?', a: 'Van woonkamer tot festivalweide. Geluid en licht worden afgestemd op de grootte van je feest.' },
      { q: 'En de buren dan?', a: 'In het kennismakingsgesprek spreken we het volume en de eindtijd af, en ik stem de opstelling af op de ruimte.' },
      { q: 'Kun je ook buiten draaien?', a: 'Ja: op dakterrassen, pleinen, in parken en op festivals. Ik heb alleen stroom nodig, en een overkapping voor de apparatuur als het kan gaan regenen.' },
      { q: 'Kun je een factuur sturen voor een bedrijfsfeest?', a: 'Ja, je krijgt een factuur van Epping Music.' },
      { q: 'Draai je ook buiten Amsterdam?', a: 'Ja. Ik draai in Amsterdam en tot ongeveer een uur daaromheen, bijvoorbeeld in Haarlem, Amstelveen, Utrecht of Rotterdam. De reistijd zit in de offerte.' },
      { q: 'Welke muziek draai je?', a: 'House, techno, trance, UK garage, of een mix die past bij je gasten. Dat bepalen we samen in het kennismakingsgesprek.' },
      { q: 'Hoe ver van tevoren moet ik boeken?', a: 'Zo vroeg mogelijk. Een paar maanden van tevoren is ideaal, last minute kan soms ook.' },
    ],
    cta: 'Plan je feest',
    mail: { subject: 'Aanvraag voor mijn feest', body: 'Hoi EPPING,\n\nIk organiseer een [soort feest] op [datum] en wil je graag boeken als DJ!\n\n' },
    whatsapp: 'Hoi EPPING, ik organiseer een [soort feest] op [datum] en wil je graag boeken als DJ!',
    captions: ['Hoofddorpplein Festival, het publiek', 'Hoofddorpplein Festival, achter de draaitafels', 'Jonge fans bij de draaitafels'],
  },
  presents: {
    path: 'epping-presents',
    title: 'EPPING Presents | Pop-up feesten in Amsterdam',
    description: 'Onze eigen feesten, open voor iedereen: daken, parken en pleinen in Amsterdam. Volg @epping.music voor het volgende feest.',
    tagline: 'Overal waar de stekker in kan',
    intro: 'Onze eigen feesten, open voor iedereen. De muziek waar we van houden, keihard, zolang we ermee wegkomen.',
    body: ['Een paar keer per jaar nemen we een plek over, van dak tot plein. Volg ons, dan mis je de volgende niet.'],
    includes: [],
    cta: 'Volg ons voor het volgende feest',
    event: { date: 'Do 22 oktober 2026', place: 'Hoofddorpplein, Amsterdam', note: 'Silent disco tijdens ADE · 19:00 – 22:00' }, // remove together with the English one
    captions: ['Vanaf de straat', 'Set bij zonsondergang', 'Nog één', 'Handen in de lucht', 'Lichten aan', 'Klaarmaken', 'Soundcheck', 'Eerste plaat', 'Dak met uitzicht', 'Hallo', 'In de mix'],
  },
};

export const UI = {
  en: { back: '← Back to the street', backRoof: '← Back to the roof', next: 'Next party', email: 'Email', copy: 'Copy', copied: 'Copied', follow: 'Follow', mixes: 'All mixes on SoundCloud ↗', gallery: 'Footage from the dancefloor', others: 'Other services', play: 'Play', view: 'View', faq: 'Questions', faqJump: 'FAQ ↓' },
  nl: { back: '← Terug naar de straat', backRoof: '← Terug naar het dak', next: 'Volgende feest', email: 'E-mail', copy: 'Kopieer', copied: 'Gekopieerd', follow: 'Volg', mixes: 'Alle mixes op SoundCloud ↗', gallery: 'Beelden van de dansvloer', others: 'Andere diensten', play: 'Afspelen', view: 'Bekijk', faq: 'Vragen', faqJump: 'FAQ ↓' },
} as const;

/** a product page's URL in a language: /<slug>/ or /nl/<dutch slug>/ */
export const floorPath = (f: Floor, lang: Lang) => (lang === 'nl' ? `/nl/${NL[f.slug].path}/` : `/${f.slug}/`);

/** the floor with its copy in the given language (media, mix and links stay shared) */
export function localize(f: Floor, lang: Lang): Floor {
  if (lang === 'en') return f;
  const { path: _p, captions, ...nl } = NL[f.slug];
  const gallery = f.gallery && { title: UI.nl.gallery, items: f.gallery.items.map((it, i) => ({ ...it, caption: captions?.[i] ?? it.caption })) };
  return { ...f, ...nl, event: f.event && nl.event, gallery };
}

